"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadEnvFile } = require("node:process");
const { randomBytes } = require("node:crypto");

if (process.env.RUN_MAINTENANCE_API_INTEGRATION !== "1") {
  test("HTTP maintenance integration (opt-in)", { skip: true }, () => {});
} else {
  const TEST_DB = "fleet_master_assignment_test";
  loadEnvFile(path.resolve(__dirname, "../../.env"));
  process.env.db_name = TEST_DB;
  const testJwtSecret = randomBytes(48).toString("hex");
  process.env.JWT_SECRET = testJwtSecret;

  const localDatabaseHosts = new Set(["localhost", "127.0.0.1", "::1", "/var/run/postgresql"]);
  assert.ok(localDatabaseHosts.has(process.env.db_host), "HTTP tests require an explicitly configured local PostgreSQL host");

  const pool = require("../database.js");
  const bcrypt = require("bcryptjs");
  const jwt = require("jsonwebtoken");
  const fixturePrefix = `API-${randomBytes(5).toString("hex")}`;
  const fixturePassword = randomBytes(24).toString("hex");
  const vehicleIds = [];
  const employeeIds = [];
  let fixtureCounter = 0;
  let databaseVerified = false;
  let server;
  let baseUrl;
  let manager;
  let passwordHash;

  before(async () => {
    assert.equal(pool.options.database, TEST_DB);
    const { rows } = await pool.query("SELECT current_database() AS name");
    assert.equal(rows[0].name, TEST_DB);
    databaseVerified = true;

    const app = require("../server.js");
    assert.equal(process.env.db_name, TEST_DB);
    assert.equal(process.env.JWT_SECRET, testJwtSecret, "Test JWT secret must not be replaced");
    assert.equal(typeof app.listen, "function", "server.js must export the Express app");
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    baseUrl = `http://127.0.0.1:${server.address().port}`;
    passwordHash = await bcrypt.hash(fixturePassword, 10);
    manager = await createAuthenticatedUser("Fleet Manager");
  });

  after(async () => {
    try {
      if (server?.listening) {
        await new Promise((resolve, reject) => {
          server.close(error => error ? reject(error) : resolve());
        });
      }
    } finally {
      try {
        if (databaseVerified) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");
            await client.query("DELETE FROM public.maintenance_records WHERE vehicle_id = ANY($1::int[])", [vehicleIds]);
            await client.query("DELETE FROM public.vehicle_assignment_history WHERE vehicle_id = ANY($1::int[])", [vehicleIds]);
            await client.query("DELETE FROM public.vehicles WHERE vehicle_id = ANY($1::int[])", [vehicleIds]);
            await client.query(`DELETE FROM public.user_sessions WHERE user_id IN
              (SELECT id FROM public.users WHERE employee_id = ANY($1::text[]))`, [employeeIds]);
            await client.query("DELETE FROM public.users WHERE employee_id = ANY($1::text[])", [employeeIds]);
            await client.query("COMMIT");
          } catch (error) {
            try { await client.query("ROLLBACK"); } catch { /* Preserve original error. */ }
            throw error;
          } finally {
            client.release();
          }
        }
      } finally {
        await pool.end();
      }
    }
  });

  async function request(method, endpoint, { token, body, authorization } = {}) {
    const headers = {};
    if (authorization !== undefined) headers.Authorization = authorization;
    else if (token !== undefined) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const content = await response.text();
    let data;
    try { data = JSON.parse(content); }
    catch { assert.fail(`${method} ${endpoint} returned non-JSON HTTP ${response.status}`); }
    return { status: response.status, data };
  }

  function expectResponse(response, status, success) {
    assert.equal(response.status, status, response.data?.message);
    assert.equal(response.data.success, success);
    assert.equal(typeof response.data.message, "string");
  }

  async function createUser(role, status = "approved") {
    assert.ok(databaseVerified);
    const employeeId = `${fixturePrefix}-${++fixtureCounter}`;
    const email = `${employeeId}@example.invalid`;
    const { rows } = await pool.query(
      `INSERT INTO public.users (email, password, employee_id, firstname, lastname, role, status)
       VALUES ($1, $2, $3, 'Integration', 'Fixture', $4, $5) RETURNING id`,
      [email, passwordHash, employeeId, role, status]
    );
    employeeIds.push(employeeId);
    return { id: rows[0].id, employeeId, email, role };
  }

  async function createAuthenticatedUser(role) {
    const user = await createUser(role);
    const login = await request("POST", "/login", {
      body: { email: user.email, password: fixturePassword },
    });
    expectResponse(login, 200, true);
    assert.equal(login.data.role, role);
    assert.equal(typeof login.data.token, "string");
    const claims = jwt.verify(login.data.token, testJwtSecret);
    assert.equal(String(claims.userId), String(user.id));
    assert.equal(typeof claims.sid, "string");
    const { rows } = await pool.query(
      "SELECT user_id, revoked_at, expires_at > NOW() AS active FROM public.user_sessions WHERE id = $1", [claims.sid]
    );
    assert.equal(rows.length, 1);
    assert.equal(String(rows[0].user_id), String(user.id));
    assert.equal(rows[0].revoked_at, null);
    assert.equal(rows[0].active, true);
    return { ...user, token: login.data.token, sessionId: claims.sid };
  }

  async function createVehicle() {
    assert.ok(databaseVerified);
    const plateNumber = `${fixturePrefix}${(++fixtureCounter).toString(36)}`;
    const { rows } = await pool.query(
      `INSERT INTO public.vehicles (plate_number, make, model, year, status, current_odometer)
       VALUES ($1, 'Toyota', 'Test', 2022, 'available', 1000) RETURNING vehicle_id`, [plateNumber]
    );
    vehicleIds.push(rows[0].vehicle_id);
    return rows[0].vehicle_id;
  }

  function maintenanceDetails(overrides = {}) {
    return {
      maintenance_type: "Preventive maintenance",
      description: "Engine oil and filter replacement",
      maintenance_date: new Date().toISOString().slice(0, 10),
      odometer_reading: 1200,
      cost: "15000.00",
      ...overrides,
    };
  }

  const maintenancePath = vehicleId => `/vehicles/${vehicleId}/maintenance`;
  const recordPath = (vehicleId, maintenanceId) => `${maintenancePath(vehicleId)}/${maintenanceId}`;
  const readinessPath = (vehicleId, maintenanceId) => `${recordPath(vehicleId, maintenanceId)}/confirm-ready`;

  async function getVehicleState(vehicleId) {
    const { rows } = await pool.query(
      "SELECT status, assigned_driver_id, current_odometer FROM public.vehicles WHERE vehicle_id = $1", [vehicleId]
    );
    return rows[0];
  }

  async function getMaintenanceRecords(vehicleId) {
    const { rows } = await pool.query(
      "SELECT * FROM public.maintenance_records WHERE vehicle_id = $1 ORDER BY maintenance_id", [vehicleId]
    );
    return rows;
  }

  async function startMaintenanceThroughApi(vehicleId) {
    const response = await request("POST", maintenancePath(vehicleId), {
      token: manager.token, body: maintenanceDetails(),
    });
    expectResponse(response, 201, true);
    assert.equal(response.data.maintenance.vehicle_id, vehicleId);
    return response.data.maintenance;
  }

  async function completeMaintenanceThroughApi(vehicleId, maintenanceId) {
    const response = await request("PATCH", recordPath(vehicleId, maintenanceId), {
      token: manager.token, body: { status: "completed" },
    });
    expectResponse(response, 200, true);
    return response.data.maintenance;
  }

  async function assertMaintenanceAccessDenied(vehicleId, maintenanceId, options, status) {
    const beforeVehicle = await getVehicleState(vehicleId);
    const beforeRecords = await getMaintenanceRecords(vehicleId);
    for (const [method, endpoint, body] of [
      ["POST", maintenancePath(vehicleId), maintenanceDetails()],
      ["GET", maintenancePath(vehicleId), undefined],
      ["PATCH", recordPath(vehicleId, maintenanceId), { description: "Denied update" }],
      ["PATCH", readinessPath(vehicleId, maintenanceId), undefined],
    ]) {
      expectResponse(await request(method, endpoint, { ...options, body }), status, false);
    }
    assert.deepEqual(await getVehicleState(vehicleId), beforeVehicle);
    assert.deepEqual(await getMaintenanceRecords(vehicleId), beforeRecords);
  }

  test("Fleet Manager can log in and receives a registered active session", async () => {
    assert.equal(manager.role, "Fleet Manager");
    const vehicleId = await createVehicle();
    const response = await request("GET", maintenancePath(vehicleId), { token: manager.token });
    assert.equal(response.status, 200);
    assert.equal(response.data.success, true);
    assert.deepEqual(response.data.maintenance_records, []);
  });

  test("all maintenance endpoints reject unauthenticated and malformed authentication", async () => {
    const vehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    for (const options of [{}, { authorization: "Basic invalid" }, { token: "invalid-token" }]) {
      await assertMaintenanceAccessDenied(vehicleId, record.maintenance_id, options, 401);
    }
  });

  test("all maintenance endpoints reject authenticated users without the Fleet Manager role", async () => {
    const vehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    for (const role of ["Driver", "Finance Manager", "admin"]) {
      const user = await createAuthenticatedUser(role);
      await assertMaintenanceAccessDenied(vehicleId, record.maintenance_id, { token: user.token }, 403);
    }
  });

  test("revoked sessions cannot access maintenance endpoints", async () => {
    const user = await createAuthenticatedUser("Fleet Manager");
    const vehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    await pool.query("UPDATE public.user_sessions SET revoked_at = NOW() WHERE id = $1", [user.sessionId]);
    await assertMaintenanceAccessDenied(vehicleId, record.maintenance_id, { token: user.token }, 401);
  });

  test("expired and idle sessions cannot access maintenance endpoints", async () => {
    const vehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    const expiredUser = await createAuthenticatedUser("Fleet Manager");
    const idleUser = await createAuthenticatedUser("Fleet Manager");
    await pool.query("UPDATE public.user_sessions SET expires_at = NOW() - INTERVAL '1 minute' WHERE id = $1", [expiredUser.sessionId]);
    await pool.query("UPDATE public.user_sessions SET last_activity_at = NOW() - INTERVAL '11 minutes' WHERE id = $1", [idleUser.sessionId]);
    for (const user of [expiredUser, idleUser]) {
      await assertMaintenanceAccessDenied(vehicleId, record.maintenance_id, { token: user.token }, 401);
    }
  });

  test("account deactivation and role changes are enforced for existing sessions", async () => {
    const vehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    const deactivatedUser = await createAuthenticatedUser("Fleet Manager");
    const reassignedUser = await createAuthenticatedUser("Fleet Manager");
    await pool.query("UPDATE public.users SET status = 'deactivated' WHERE id = $1", [deactivatedUser.id]);
    await pool.query("UPDATE public.users SET role = 'Driver' WHERE id = $1", [reassignedUser.id]);
    await assertMaintenanceAccessDenied(vehicleId, record.maintenance_id, { token: deactivatedUser.token }, 401);
    await assertMaintenanceAccessDenied(vehicleId, record.maintenance_id, { token: reassignedUser.token }, 403);
  });

  test("maintenance initiation persists a record and updates vehicle state through HTTP", async () => {
    const vehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    assert.equal(record.status, "in progress");
    assert.deepEqual(await getVehicleState(vehicleId), { status: "maintenance", assigned_driver_id: null, current_odometer: 1200 });
    const records = await getMaintenanceRecords(vehicleId);
    assert.equal(records.length, 1);
    assert.equal(records[0].maintenance_id, record.maintenance_id);
    assert.equal(records[0].description, record.description);
  });

  test("invalid maintenance requests and duplicate initiation return meaningful HTTP errors", async () => {
    const vehicleId = await createVehicle();
    expectResponse(await request("POST", maintenancePath(vehicleId), {
      token: manager.token, body: maintenanceDetails({ odometer_reading: -1 }),
    }), 400, false);
    expectResponse(await request("POST", maintenancePath("invalid"), {
      token: manager.token, body: maintenanceDetails(),
    }), 400, false);
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 0);
    assert.equal((await getVehicleState(vehicleId)).status, "available");
    await startMaintenanceThroughApi(vehicleId);
    expectResponse(await request("POST", maintenancePath(vehicleId), {
      token: manager.token, body: maintenanceDetails(),
    }), 409, false);
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 1);
  });

  test("maintenance history returns the persisted records belonging to the vehicle", async () => {
    const vehicleId = await createVehicle();
    const otherVehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    await startMaintenanceThroughApi(otherVehicleId);
    const response = await request("GET", maintenancePath(vehicleId), { token: manager.token });
    assert.equal(response.status, 200);
    assert.equal(response.data.success, true);
    assert.equal(response.data.maintenance_records.length, 1);
    assert.equal(response.data.maintenance_records[0].maintenance_id, record.maintenance_id);
    assert.equal(response.data.maintenance_records[0].vehicle_id, vehicleId);
  });

  test("maintenance update rejects invalid fields and mismatched vehicle records", async () => {
    const vehicleId = await createVehicle();
    const otherVehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    const beforeRecords = await getMaintenanceRecords(vehicleId);
    expectResponse(await request("PATCH", recordPath(vehicleId, record.maintenance_id), {
      token: manager.token, body: { odometer_reading: 1100 },
    }), 400, false);
    expectResponse(await request("PATCH", recordPath(otherVehicleId, record.maintenance_id), {
      token: manager.token, body: { cost: "25000.00" },
    }), 404, false);
    assert.deepEqual(await getMaintenanceRecords(vehicleId), beforeRecords);
  });

  test("maintenance updates synchronize mileage and completion remains separate from readiness", async () => {
    const vehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    const update = await request("PATCH", recordPath(vehicleId, record.maintenance_id), {
      token: manager.token, body: { odometer_reading: 1400, description: "Oil filter replaced" },
    });
    expectResponse(update, 200, true);
    assert.equal(update.data.maintenance.odometer_reading, 1400);
    assert.equal((await getVehicleState(vehicleId)).current_odometer, 1400);
    assert.equal((await getMaintenanceRecords(vehicleId))[0].description, "Oil filter replaced");
    const completed = await completeMaintenanceThroughApi(vehicleId, record.maintenance_id);
    assert.equal(completed.status, "completed");
    assert.ok(completed.completed_at);
    assert.equal(completed.ready_confirmed_at, null);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  test("readiness is rejected before completion and succeeds only once afterward", async () => {
    const vehicleId = await createVehicle();
    const record = await startMaintenanceThroughApi(vehicleId);
    const endpoint = readinessPath(vehicleId, record.maintenance_id);
    expectResponse(await request("PATCH", endpoint, { token: manager.token }), 409, false);
    assert.equal((await getMaintenanceRecords(vehicleId))[0].ready_confirmed_at, null);
    await completeMaintenanceThroughApi(vehicleId, record.maintenance_id);
    const response = await request("PATCH", endpoint, { token: manager.token });
    expectResponse(response, 200, true);
    assert.equal(response.data.vehicle.vehicle_id, vehicleId);
    assert.equal(response.data.vehicle.status, "available");
    assert.equal(response.data.maintenance.status, "completed");
    assert.ok(response.data.maintenance.ready_confirmed_at);
    assert.equal((await getVehicleState(vehicleId)).status, "available");
    const records = await getMaintenanceRecords(vehicleId);
    assert.ok(records[0].ready_confirmed_at instanceof Date);
    expectResponse(await request("PATCH", endpoint, { token: manager.token }), 409, false);
    assert.deepEqual(await getMaintenanceRecords(vehicleId), records);
  });
}
