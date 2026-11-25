"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadEnvFile } = require("node:process");
const { randomBytes } = require("node:crypto");

// Explicit opt-in: ordinary unit-test runs must not write to PostgreSQL.
if (process.env.RUN_ASSIGNMENT_INTEGRATION !== "1") {
  test("PostgreSQL assignment integration (opt-in)", { skip: true }, () => {});
} else {
  loadEnvFile(path.resolve(__dirname, "../../.env"));
  const TEST_DB = "fleet_master_assignment_test";
  process.env.db_name = TEST_DB;
  const pool = require("../src/config/database.js");
  const { assignVehicle, unassignVehicle, AssignmentError } = require("../services/vehicle-assignment-service.js");
  const prefix = `IT-${randomBytes(6).toString("hex")}`;
  const drivers = [];
  const vehicles = [];
  let verified = false;
  let counter = 0;

  before(async () => {
    const { rows } = await pool.query("SELECT current_database() AS name");
    assert.equal(rows[0].name, TEST_DB);
    verified = true;
  });

  after(async () => {
    try {
      if (verified) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("DELETE FROM public.vehicle_assignment_history WHERE vehicle_id = ANY($1::int[])", [vehicles]);
          await client.query("DELETE FROM public.vehicles WHERE vehicle_id = ANY($1::int[])", [vehicles]);
          await client.query("DELETE FROM public.users WHERE employee_id = ANY($1::text[])", [drivers]);
          await client.query("COMMIT");
        } catch (error) {
          try { await client.query("ROLLBACK"); } catch { /* preserve original error */ }
          throw error;
        } finally { client.release(); }
      }
    } finally { await pool.end(); }
  });

  async function driver(role = "Driver", status = "approved") {
    const id = `${prefix}-${++counter}`;
    await pool.query(`INSERT INTO public.users (email, password, employee_id, firstname, lastname, role, status)
      VALUES ($1, $2, $3, 'Integration', 'Fixture', $4, $5)`,
      [`${id}@example.invalid`, "not-a-login-credential", id, role, status]);
    drivers.push(id);
    return id;
  }

  async function vehicle(status = "available") {
    const plate = `${prefix}${(++counter).toString(36)}`;
    const { rows } = await pool.query(`INSERT INTO public.vehicles (plate_number, make, model, year, status)
      VALUES ($1, 'Toyota', 'Test', 2022, $2) RETURNING vehicle_id`, [plate, status]);
    vehicles.push(rows[0].vehicle_id);
    return rows[0].vehicle_id;
  }

  async function state(id) {
    const { rows } = await pool.query("SELECT assigned_driver_id, status FROM public.vehicles WHERE vehicle_id=$1", [id]);
    return rows[0];
  }
  async function history(id) {
    const { rows } = await pool.query("SELECT * FROM public.vehicle_assignment_history WHERE vehicle_id=$1 ORDER BY assignment_id", [id]);
    return rows;
  }
  const rejectsStatus = (promise, status) => assert.rejects(promise, error => error instanceof AssignmentError && error.status === status);

  test("assignment, duplicate rejection, unassignment and reassignment preserve history", async () => {
    const v = await vehicle();
    const d = await driver();
    const d2 = await driver();
    const v2 = await vehicle();
    const result = await assignVehicle(v, d);
    assert.equal(result.assigned_driver_id, d);
    assert.equal(result.firstname, "Integration");
    assert.deepEqual(await state(v), { assigned_driver_id: d, status: "in use" });
    let h = await history(v);
    assert.equal(h.length, 1);
    assert.equal(h[0].driver_employee_id, d);
    assert.ok(h[0].assigned_at instanceof Date);
    assert.equal(h[0].unassigned_at, null);
    await rejectsStatus(assignVehicle(v, d2), 409);
    await rejectsStatus(assignVehicle(v2, d), 409);
    assert.deepEqual(await state(v2), { assigned_driver_id: null, status: "available" });
    assert.equal((await history(v2)).length, 0);
    await unassignVehicle(v, "integration test");
    assert.deepEqual(await state(v), { assigned_driver_id: null, status: "available" });
    h = await history(v);
    assert.equal(h.length, 1);
    assert.ok(h[0].unassigned_at >= h[0].assigned_at);
    assert.equal(h[0].unassignment_reason, "integration test");
    await rejectsStatus(unassignVehicle(v), 409);
    await assignVehicle(v, d2);
    h = await history(v);
    assert.equal(h.length, 2);
    assert.equal(h[1].driver_employee_id, d2);
    assert.equal(h[1].unassigned_at, null);
  });

  test("ineligible drivers and unavailable vehicles cannot be assigned", async () => {
    const v = await vehicle();
    const pending = await driver("Driver", "pending");
    const nonDriver = await driver("Other", "approved");
    const approved = await driver();
    await rejectsStatus(assignVehicle(v, pending), 400);
    await rejectsStatus(assignVehicle(v, nonDriver), 400);
    await rejectsStatus(assignVehicle(v, `${prefix}-missing`), 400);
    for (const status of ["maintenance", "out of service"]) {
      const blocked = await vehicle(status);
      await rejectsStatus(assignVehicle(blocked, approved), 409);
      assert.deepEqual(await state(blocked), { assigned_driver_id: null, status });
      assert.equal((await history(blocked)).length, 0);
    }
    assert.deepEqual(await state(v), { assigned_driver_id: null, status: "available" });
    assert.equal((await history(v)).length, 0);
  });

  test("missing history blocks unassignment without changing vehicle", async () => {
    const v = await vehicle();
    const d = await driver();
    await pool.query("UPDATE public.vehicles SET assigned_driver_id=$1, status='in use' WHERE vehicle_id=$2", [d,v]);
    await rejectsStatus(unassignVehicle(v), 409);
    assert.deepEqual(await state(v), { assigned_driver_id: d, status: "in use" });
    assert.equal((await history(v)).length, 0);
  });

  test("database constraints independently reject duplicate active history", async () => {
    const v1 = await vehicle(); const v2 = await vehicle();
    const d1 = await driver(); const d2 = await driver();
    await assignVehicle(v1,d1);
    const insert = (v,d) => pool.query("INSERT INTO public.vehicle_assignment_history (vehicle_id,driver_employee_id) VALUES ($1,$2)",[v,d]);
    await assert.rejects(insert(v1,d2), e => e.code === "23505" && e.constraint === "idx_one_active_assignment_per_vehicle");
    await assert.rejects(insert(v2,d1), e => e.code === "23505" && e.constraint === "idx_one_active_assignment_per_driver");
    assert.equal((await history(v1)).length,1);
    assert.equal((await history(v2)).length,0);
  });

  test("real history insertion failure rolls back vehicle update", async () => {
    const v = await vehicle();
    const d = await driver();
    const constraint = `it_rollback_${randomBytes(8).toString("hex")}`;
    assert.ok(Number.isSafeInteger(v) && v > 0);
    assert.deepEqual(await state(v), { assigned_driver_id: null, status: "available" });
    assert.equal((await history(v)).length, 0);

    // Test-only constraint: reject history for this fixture vehicle only.
    // The database name is verified in the before hook before any writes.
    await pool.query(`ALTER TABLE public.vehicle_assignment_history
      ADD CONSTRAINT ${constraint} CHECK (vehicle_id <> ${v}) NOT VALID`);
    try {
      await assert.rejects(assignVehicle(v, d), error =>
        error.code === "23514" && error.constraint === constraint);
      assert.deepEqual(await state(v), { assigned_driver_id: null, status: "available" });
      assert.equal((await history(v)).length, 0);
    } finally {
      await pool.query(`ALTER TABLE public.vehicle_assignment_history
        DROP CONSTRAINT ${constraint}`);
    }

    // Removing the injected failure must allow a normal assignment.
    await assignVehicle(v, d);
    assert.deepEqual(await state(v), { assigned_driver_id: d, status: "in use" });
    assert.equal((await history(v)).length, 1);
  });

  function winner(results) {
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    const failure = results.find(r => r.status === "rejected");
    assert.ok(failure.reason instanceof AssignmentError);
    assert.equal(failure.reason.status,409);
    return results.find(r => r.status === "fulfilled").value;
  }

  test("parallel requests for one vehicle produce one assignment", async () => {
    const v = await vehicle(); const a = await driver(); const b = await driver();
    const result = winner(await Promise.allSettled([assignVehicle(v,a),assignVehicle(v,b)]));
    assert.deepEqual(await state(v), {assigned_driver_id:result.assigned_driver_id,status:"in use"});
    const h = await history(v);
    assert.equal(h.length,1);
    assert.equal(h[0].driver_employee_id,result.assigned_driver_id);
    assert.equal(h[0].unassigned_at,null);
  });

  test("parallel requests for one driver produce one assignment", async () => {
    const a = await vehicle(); const b = await vehicle(); const d = await driver();
    const result = winner(await Promise.allSettled([assignVehicle(a,d),assignVehicle(b,d)]));
    const loser = result.vehicle_id === a ? b : a;
    assert.deepEqual(await state(result.vehicle_id), {assigned_driver_id:d,status:"in use"});
    assert.deepEqual(await state(loser), {assigned_driver_id:null,status:"available"});
    const h = await history(result.vehicle_id);
    assert.equal(h.length,1);
    assert.equal(h[0].driver_employee_id,d);
    assert.equal(h[0].unassigned_at,null);
    assert.equal((await history(loser)).length,0);
  });
}
