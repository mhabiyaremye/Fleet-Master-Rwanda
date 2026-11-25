"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadEnvFile } = require("node:process");
const { randomBytes } = require("node:crypto");

if (process.env.RUN_MAINTENANCE_INTEGRATION !== "1") {
  test("PostgreSQL maintenance integration (opt-in)", { skip: true }, () => {});
} else {
  loadEnvFile(path.resolve(__dirname, "../../.env"));
  const TEST_DB = "fleet_master_assignment_test";
  process.env.db_name = TEST_DB;
  const pool = require("../src/config/database.js");
  const { startMaintenance, updateMaintenance, confirmVehicleReady, MaintenanceError } = require("../services/vehicle-maintenance-service.js");
  const { assignVehicle, AssignmentError } = require("../services/vehicle-assignment-service.js");
  const fixturePrefix = `MT-${randomBytes(6).toString("hex")}`;
  const vehicleIds = [];
  const driverIds = [];
  let databaseVerified = false;
  let fixtureCounter = 0;

  before(async () => {
    const { rows } = await pool.query("SELECT current_database() AS name");
    assert.equal(rows[0].name, TEST_DB);
    databaseVerified = true;
  });

  after(async () => {
    try {
      if (databaseVerified) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query("DELETE FROM public.maintenance_records WHERE vehicle_id = ANY($1::int[])", [vehicleIds]);
          await client.query("DELETE FROM public.vehicle_assignment_history WHERE vehicle_id = ANY($1::int[])", [vehicleIds]);
          await client.query("DELETE FROM public.vehicles WHERE vehicle_id = ANY($1::int[])", [vehicleIds]);
          await client.query("DELETE FROM public.users WHERE employee_id = ANY($1::text[])", [driverIds]);
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
  });

  async function createVehicle() {
    assert.ok(databaseVerified, "Test database must be verified before fixture creation");
    const plateNumber = `${fixturePrefix}${(++fixtureCounter).toString(36)}`;
    const { rows } = await pool.query(
      `INSERT INTO public.vehicles (plate_number, make, model, year, status, current_odometer)
       VALUES ($1, 'Toyota', 'Test', 2022, 'available', 1000) RETURNING vehicle_id`,
      [plateNumber]
    );
    vehicleIds.push(rows[0].vehicle_id);
    return rows[0].vehicle_id;
  }

  async function createDriver() {
    assert.ok(databaseVerified, "Test database must be verified before fixture creation");
    const employeeId = `${fixturePrefix}-${++fixtureCounter}`;
    await pool.query(
      `INSERT INTO public.users (email, password, employee_id, firstname, lastname, role, status)
       VALUES ($1, $2, $3, 'Integration', 'Fixture', 'Driver', 'approved')`,
      [`${employeeId}@example.invalid`, "not-a-login-credential", employeeId]
    );
    driverIds.push(employeeId);
    return employeeId;
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

  async function getAssignmentHistory(vehicleId) {
    const { rows } = await pool.query(
      "SELECT * FROM public.vehicle_assignment_history WHERE vehicle_id = $1 ORDER BY assignment_id", [vehicleId]
    );
    return rows;
  }

  function rejectsMaintenance(promise, status) {
    return assert.rejects(promise, error => error instanceof MaintenanceError && error.status === status);
  }

  // Maintenance initiation and database integrity.
  test("available vehicle enters maintenance", async () => {
    const vehicleId = await createVehicle();
    const record = await startMaintenance(vehicleId, maintenanceDetails());
    assert.equal(record.vehicle_id, vehicleId);
    assert.equal(record.status, "in progress");
    assert.equal(record.completed_at, null);
    assert.equal(record.ready_confirmed_at, null);
    assert.deepEqual(await getVehicleState(vehicleId), { status: "maintenance", assigned_driver_id: null, current_odometer: 1200 });
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 1);
  });

  test("maintenance closes assignment and releases driver", async () => {
    const vehicleId = await createVehicle();
    const replacementVehicleId = await createVehicle();
    const driverId = await createDriver();
    await assignVehicle(vehicleId, driverId);
    await startMaintenance(vehicleId, maintenanceDetails());
    const history = await getAssignmentHistory(vehicleId);
    assert.equal(history.length, 1);
    assert.equal(history[0].driver_employee_id, driverId);
    assert.ok(history[0].unassigned_at instanceof Date);
    assert.ok(history[0].unassigned_at >= history[0].assigned_at);
    assert.equal(history[0].unassignment_reason, "maintenance");
    const vehicle = await getVehicleState(vehicleId);
    assert.equal(vehicle.status, "maintenance");
    assert.equal(vehicle.assigned_driver_id, null);
    await assignVehicle(replacementVehicleId, driverId);
    assert.equal((await getVehicleState(replacementVehicleId)).assigned_driver_id, driverId);
  });

  test("duplicate maintenance request is rejected", async () => {
    const vehicleId = await createVehicle();
    await startMaintenance(vehicleId, maintenanceDetails());
    await rejectsMaintenance(startMaintenance(vehicleId, maintenanceDetails()), 409);
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 1);
  });

  test("vehicle under maintenance cannot be assigned", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();
    await startMaintenance(vehicleId, maintenanceDetails());
    await assert.rejects(assignVehicle(vehicleId, driverId), error => error instanceof AssignmentError && error.status === 409);
    assert.equal((await getAssignmentHistory(vehicleId)).length, 0);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  test("invalid maintenance details are rejected", async () => {
    const vehicleId = await createVehicle();
    for (const details of [
      { maintenance_type: "" }, { description: " " }, { maintenance_date: "2026-02-30" },
      { odometer_reading: -1 }, { odometer_reading: null }, { cost: "-100" }, { cost: "100.999" },
    ]) {
      await rejectsMaintenance(startMaintenance(vehicleId, maintenanceDetails(details)), 400);
    }
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 0);
    assert.equal((await getVehicleState(vehicleId)).status, "available");
  });

  test("maintenance cannot decrease vehicle odometer", async () => {
    const vehicleId = await createVehicle();
    await rejectsMaintenance(startMaintenance(vehicleId, maintenanceDetails({ odometer_reading: 999 })), 400);
    assert.deepEqual(await getVehicleState(vehicleId), { status: "available", assigned_driver_id: null, current_odometer: 1000 });
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 0);
  });

  test("missing assignment history prevents maintenance", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();
    await pool.query("UPDATE public.vehicles SET status = 'in use', assigned_driver_id = $1 WHERE vehicle_id = $2", [driverId, vehicleId]);
    await rejectsMaintenance(startMaintenance(vehicleId, maintenanceDetails()), 409);
    assert.deepEqual(await getVehicleState(vehicleId), { status: "in use", assigned_driver_id: driverId, current_odometer: 1000 });
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 0);
  });

  test("database rejects duplicate active maintenance", async () => {
    const vehicleId = await createVehicle();
    await startMaintenance(vehicleId, maintenanceDetails());
    await assert.rejects(pool.query(
      `INSERT INTO public.maintenance_records (vehicle_id, maintenance_type, description, maintenance_date, odometer_reading, cost)
       SELECT vehicle_id, maintenance_type, description, maintenance_date, odometer_reading, cost
       FROM public.maintenance_records WHERE vehicle_id = $1 AND status = 'in progress'`, [vehicleId]
    ), error => error.code === "23505" && error.constraint === "idx_one_active_maintenance_per_vehicle");
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 1);
  });

  test("database rejects negative vehicle odometer", async () => {
    const vehicleId = await createVehicle();
    await assert.rejects(pool.query("UPDATE public.vehicles SET current_odometer = -1 WHERE vehicle_id = $1", [vehicleId]),
      error => error.code === "23514" && error.constraint === "chk_vehicle_current_odometer_nonnegative");
    assert.equal((await getVehicleState(vehicleId)).current_odometer, 1000);
  });

  test("maintenance insertion failure rolls back assignment closure", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();
    await assignVehicle(vehicleId, driverId);
    const constraintName = `mt_insert_failure_${randomBytes(6).toString("hex")}`;
    assert.ok(Number.isSafeInteger(vehicleId) && vehicleId > 0);
    await pool.query(`ALTER TABLE public.maintenance_records ADD CONSTRAINT ${constraintName} CHECK (vehicle_id <> ${vehicleId}) NOT VALID`);
    try {
      await assert.rejects(startMaintenance(vehicleId, maintenanceDetails()), error => error.code === "23514" && error.constraint === constraintName);
      assert.deepEqual(await getVehicleState(vehicleId), { status: "in use", assigned_driver_id: driverId, current_odometer: 1000 });
      const history = await getAssignmentHistory(vehicleId);
      assert.equal(history.length, 1);
      assert.equal(history[0].unassigned_at, null);
      assert.equal(history[0].unassignment_reason, null);
      assert.equal((await getMaintenanceRecords(vehicleId)).length, 0);
    } finally {
      await pool.query(`ALTER TABLE public.maintenance_records DROP CONSTRAINT ${constraintName}`);
    }
    await startMaintenance(vehicleId, maintenanceDetails());
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  test("concurrent maintenance requests create one active record", async () => {
    const vehicleId = await createVehicle();
    const results = await Promise.allSettled([
      startMaintenance(vehicleId, maintenanceDetails()), startMaintenance(vehicleId, maintenanceDetails()),
    ]);
    const successful = results.filter(result => result.status === "fulfilled");
    const rejected = results.filter(result => result.status === "rejected");
    assert.equal(successful.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof MaintenanceError);
    assert.equal(rejected[0].reason.status, 409);
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 1);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  test("concurrent assignment and maintenance preserve vehicle state", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();
    const [assignment, maintenance] = await Promise.allSettled([
      assignVehicle(vehicleId, driverId), startMaintenance(vehicleId, maintenanceDetails()),
    ]);
    assert.equal(maintenance.status, "fulfilled");
    const vehicle = await getVehicleState(vehicleId);
    const history = await getAssignmentHistory(vehicleId);
    assert.equal(vehicle.status, "maintenance");
    assert.equal(vehicle.assigned_driver_id, null);
    assert.equal(vehicle.current_odometer, 1200);
    if (assignment.status === "fulfilled") {
      assert.equal(history.length, 1);
      assert.equal(history[0].driver_employee_id, driverId);
      assert.ok(history[0].unassigned_at instanceof Date);
      assert.equal(history[0].unassignment_reason, "maintenance");
    } else {
      assert.ok(assignment.reason instanceof AssignmentError);
      assert.equal(assignment.reason.status, 409);
      assert.equal(history.length, 0);
    }
    assert.equal((await getMaintenanceRecords(vehicleId)).length, 1);
  });

  // Maintenance updates and completion (readiness confirmation is separate).
  test("maintenance details can be updated", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    const updatedMaintenance = await updateMaintenance(vehicleId, maintenance.maintenance_id, {
      maintenance_type: "Corrective maintenance", description: "Brake pad replacement", cost: "25000.00",
    });
    assert.equal(updatedMaintenance.maintenance_type, "Corrective maintenance");
    assert.equal(updatedMaintenance.description, "Brake pad replacement");
    assert.equal(Number(updatedMaintenance.cost), 25000);
    assert.equal(updatedMaintenance.status, "in progress");
    const records = await getMaintenanceRecords(vehicleId);
    assert.equal(records.length, 1);
    assert.equal(records[0].description, "Brake pad replacement");
    assert.equal(Number(records[0].cost), 25000);
  });

  test("partial maintenance update preserves unspecified fields", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    const updatedMaintenance = await updateMaintenance(vehicleId, maintenance.maintenance_id, { description: "Oil filter replaced" });
    assert.equal(updatedMaintenance.description, "Oil filter replaced");
    assert.equal(updatedMaintenance.maintenance_type, maintenance.maintenance_type);
    assert.equal(updatedMaintenance.odometer_reading, maintenance.odometer_reading);
    assert.equal(updatedMaintenance.cost, maintenance.cost);
    assert.deepEqual(updatedMaintenance.maintenance_date, maintenance.maintenance_date);
    assert.equal(updatedMaintenance.status, maintenance.status);
  });

  test("maintenance update synchronizes vehicle odometer", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    await updateMaintenance(vehicleId, maintenance.maintenance_id, { odometer_reading: 1350 });
    const vehicle = await getVehicleState(vehicleId);
    const records = await getMaintenanceRecords(vehicleId);
    assert.equal(vehicle.current_odometer, 1350);
    assert.equal(records[0].odometer_reading, 1350);
    assert.equal(vehicle.status, "maintenance");
  });

  test("maintenance update cannot decrease odometer", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    await rejectsMaintenance(updateMaintenance(vehicleId, maintenance.maintenance_id, { odometer_reading: 1100 }), 400);
    assert.equal((await getVehicleState(vehicleId)).current_odometer, 1200);
    assert.equal((await getMaintenanceRecords(vehicleId))[0].odometer_reading, 1200);
  });

  test("invalid maintenance updates are rejected", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    for (const fields of [
      {}, { maintenance_type: "" }, { maintenance_type: "x".repeat(101) }, { description: " " },
      { maintenance_date: "2026-02-30" }, { odometer_reading: null }, { odometer_reading: -1 },
      { odometer_reading: 1200.5 }, { cost: "-100" }, { cost: "100.999" }, { cost: null },
      { status: "available" }, { status: "cancelled" },
    ]) {
      await rejectsMaintenance(updateMaintenance(vehicleId, maintenance.maintenance_id, fields), 400);
    }
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
  });

  test("maintenance completion records completion timestamp", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    const completedMaintenance = await updateMaintenance(vehicleId, maintenance.maintenance_id, { status: "completed" });
    assert.equal(completedMaintenance.status, "completed");
    assert.ok(completedMaintenance.completed_at instanceof Date);
    assert.ok(completedMaintenance.completed_at >= completedMaintenance.created_at);
    assert.equal(completedMaintenance.ready_confirmed_at, null);
    const vehicle = await getVehicleState(vehicleId);
    assert.equal(vehicle.status, "maintenance");
    assert.equal(vehicle.assigned_driver_id, null);
  });

  test("completed maintenance vehicle remains unavailable for assignment", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    await updateMaintenance(vehicleId, maintenance.maintenance_id, { status: "completed" });
    await assert.rejects(assignVehicle(vehicleId, driverId), error => error instanceof AssignmentError && error.status === 409);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
    assert.equal((await getAssignmentHistory(vehicleId)).length, 0);
  });

  test("completed maintenance cannot be modified or reopened", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    const completedMaintenance = await updateMaintenance(vehicleId, maintenance.maintenance_id, { status: "completed" });
    for (const fields of [{ description: "Unauthorized modification" }, { status: "in progress" }, { status: "completed" }]) {
      await rejectsMaintenance(updateMaintenance(vehicleId, maintenance.maintenance_id, fields), 409);
    }
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], completedMaintenance);
  });

  test("maintenance cannot be updated through another vehicle", async () => {
    const vehicleId = await createVehicle();
    const otherVehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    await rejectsMaintenance(updateMaintenance(otherVehicleId, maintenance.maintenance_id, { cost: "50000.00" }), 404);
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
    assert.equal((await getMaintenanceRecords(otherVehicleId)).length, 0);
  });

  test("inconsistent vehicle status prevents maintenance update", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    await pool.query("UPDATE public.vehicles SET status = 'available' WHERE vehicle_id = $1", [vehicleId]);
    await rejectsMaintenance(updateMaintenance(vehicleId, maintenance.maintenance_id, { status: "completed" }), 409);
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
  });

  test("vehicle odometer update failure rolls back maintenance changes", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    const constraintName = `maintenance_odometer_rollback_${randomBytes(6).toString("hex")}`;
    assert.ok(Number.isSafeInteger(vehicleId) && vehicleId > 0);
    await pool.query(`ALTER TABLE public.vehicles ADD CONSTRAINT ${constraintName}
      CHECK (vehicle_id <> ${vehicleId} OR current_odometer <= 1200) NOT VALID`);
    try {
      await assert.rejects(updateMaintenance(vehicleId, maintenance.maintenance_id, {
        description: "Brake system repaired", odometer_reading: 1400, status: "completed",
      }), error => error.code === "23514" && error.constraint === constraintName);
      assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
      assert.deepEqual(await getVehicleState(vehicleId), { status: "maintenance", assigned_driver_id: null, current_odometer: 1200 });
    } finally {
      await pool.query(`ALTER TABLE public.vehicles DROP CONSTRAINT ${constraintName}`);
    }
    const completedMaintenance = await updateMaintenance(vehicleId, maintenance.maintenance_id, { odometer_reading: 1400, status: "completed" });
    assert.equal(completedMaintenance.status, "completed");
    assert.equal((await getVehicleState(vehicleId)).current_odometer, 1400);
  });

  test("concurrent maintenance completion requests succeed only once", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    const results = await Promise.allSettled([
      updateMaintenance(vehicleId, maintenance.maintenance_id, { status: "completed" }),
      updateMaintenance(vehicleId, maintenance.maintenance_id, { status: "completed" }),
    ]);
    const successful = results.filter(result => result.status === "fulfilled");
    const rejected = results.filter(result => result.status === "rejected");
    assert.equal(successful.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof MaintenanceError);
    assert.equal(rejected[0].reason.status, 409);
    const records = await getMaintenanceRecords(vehicleId);
    assert.equal(records.length, 1);
    assert.equal(records[0].status, "completed");
    assert.ok(records[0].completed_at instanceof Date);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  // Readiness confirmation and return to service.
  async function completeVehicleMaintenance(vehicleId) {
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    return updateMaintenance(vehicleId, maintenance.maintenance_id, { status: "completed" });
  }

  test("readiness confirmation returns vehicle to service and permits reassignment", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();
    await assignVehicle(vehicleId, driverId);
    const maintenance = await completeVehicleMaintenance(vehicleId);
    const result = await confirmVehicleReady(vehicleId, maintenance.maintenance_id);
    assert.equal(result.vehicle.vehicle_id, vehicleId);
    assert.equal(result.vehicle.status, "available");
    assert.equal(typeof result.vehicle.plate_number, "string");
    assert.equal(result.maintenance.maintenance_id, maintenance.maintenance_id);
    assert.equal(result.maintenance.status, "completed");
    assert.ok(result.maintenance.ready_confirmed_at instanceof Date);
    assert.ok(result.maintenance.ready_confirmed_at >= maintenance.completed_at);
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], result.maintenance);
    assert.deepEqual(await getVehicleState(vehicleId), { status: "available", assigned_driver_id: null, current_odometer: 1200 });
    await assignVehicle(vehicleId, driverId);
    const history = await getAssignmentHistory(vehicleId);
    assert.equal(history.length, 2);
    assert.equal(history[0].unassignment_reason, "maintenance");
    assert.ok(history[0].unassigned_at instanceof Date);
    assert.equal(history[1].driver_employee_id, driverId);
    assert.equal(history[1].unassigned_at, null);
  });

  test("readiness cannot be confirmed before maintenance completion", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await startMaintenance(vehicleId, maintenanceDetails());
    await rejectsMaintenance(confirmVehicleReady(vehicleId, maintenance.maintenance_id), 409);
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  test("readiness rejects invalid vehicle and maintenance identifiers", async () => {
    for (const [vehicleId, maintenanceId] of [[0, 1], [1, -1], ["1e2", 1], [1, "1.5"], [2147483648, 1], [1, 2147483648]]) {
      await rejectsMaintenance(confirmVehicleReady(vehicleId, maintenanceId), 400);
    }
  });

  test("readiness rejects missing vehicle and maintenance records", async () => {
    const vehicleId = await createVehicle();
    const otherVehicleId = await createVehicle();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    await rejectsMaintenance(confirmVehicleReady(otherVehicleId, maintenance.maintenance_id), 404);
    await pool.query("DELETE FROM public.vehicles WHERE vehicle_id = $1", [otherVehicleId]);
    await rejectsMaintenance(confirmVehicleReady(otherVehicleId, maintenance.maintenance_id), 404);
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  test("readiness cannot be confirmed twice", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    const result = await confirmVehicleReady(vehicleId, maintenance.maintenance_id);
    await assert.rejects(confirmVehicleReady(vehicleId, maintenance.maintenance_id), error =>
      error instanceof MaintenanceError && error.status === 409 && /already been confirmed/.test(error.message));
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], result.maintenance);
    assert.equal((await getVehicleState(vehicleId)).status, "available");
  });

  test("only the latest non-cancelled maintenance record can confirm readiness", async () => {
    const vehicleId = await createVehicle();
    const previousMaintenance = await completeVehicleMaintenance(vehicleId);
    await confirmVehicleReady(vehicleId, previousMaintenance.maintenance_id);
    const latestMaintenance = await completeVehicleMaintenance(vehicleId);
    await assert.rejects(confirmVehicleReady(vehicleId, previousMaintenance.maintenance_id), error =>
      error instanceof MaintenanceError && error.status === 409 && /latest non-cancelled/.test(error.message));
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[1], latestMaintenance);
    await confirmVehicleReady(vehicleId, latestMaintenance.maintenance_id);
    assert.equal((await getVehicleState(vehicleId)).status, "available");
  });

  test("cancelled maintenance does not supersede the latest completed record", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    // Seed a historical cancelled record directly: cancellation has no service endpoint yet.
    await pool.query(
      `INSERT INTO public.maintenance_records
        (vehicle_id, maintenance_type, description, maintenance_date, odometer_reading, status, created_at)
       SELECT vehicle_id, maintenance_type, description, maintenance_date, odometer_reading,
              'cancelled', created_at + interval '1 second'
       FROM public.maintenance_records WHERE maintenance_id = $1`, [maintenance.maintenance_id]
    );
    await confirmVehicleReady(vehicleId, maintenance.maintenance_id);
    const records = await getMaintenanceRecords(vehicleId);
    assert.equal(records.length, 2);
    assert.ok(records[0].ready_confirmed_at instanceof Date);
    assert.equal(records[1].status, "cancelled");
    assert.equal(records[1].ready_confirmed_at, null);
    assert.equal((await getVehicleState(vehicleId)).status, "available");
  });

  test("unresolved maintenance blocks readiness even when the latest record is completed", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    // Seed an inconsistent legacy state to exercise the independent active-record guard.
    await pool.query(
      `INSERT INTO public.maintenance_records
        (vehicle_id, maintenance_type, description, maintenance_date, odometer_reading, status, created_at)
       SELECT vehicle_id, maintenance_type, description, maintenance_date, odometer_reading,
              'in progress', created_at - interval '1 second'
       FROM public.maintenance_records WHERE maintenance_id = $1`, [maintenance.maintenance_id]
    );
    await assert.rejects(confirmVehicleReady(vehicleId, maintenance.maintenance_id), error =>
      error instanceof MaintenanceError && error.status === 409 && /another maintenance record in progress/.test(error.message));
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  test("vehicle outside maintenance status cannot confirm readiness", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    await pool.query("UPDATE public.vehicles SET status = 'out of service' WHERE vehicle_id = $1", [vehicleId]);
    await rejectsMaintenance(confirmVehicleReady(vehicleId, maintenance.maintenance_id), 409);
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
    assert.equal((await getVehicleState(vehicleId)).status, "out of service");
  });

  test("unresolved driver reference blocks readiness confirmation", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    await pool.query("UPDATE public.vehicles SET assigned_driver_id = $1 WHERE vehicle_id = $2", [driverId, vehicleId]);
    await rejectsMaintenance(confirmVehicleReady(vehicleId, maintenance.maintenance_id), 409);
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
    assert.equal((await getVehicleState(vehicleId)).assigned_driver_id, driverId);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  test("unresolved assignment history blocks readiness confirmation", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    await pool.query("INSERT INTO public.vehicle_assignment_history (vehicle_id, driver_employee_id) VALUES ($1, $2)", [vehicleId, driverId]);
    await rejectsMaintenance(confirmVehicleReady(vehicleId, maintenance.maintenance_id), 409);
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
    const history = await getAssignmentHistory(vehicleId);
    assert.equal(history.length, 1);
    assert.equal(history[0].unassigned_at, null);
    assert.equal((await getVehicleState(vehicleId)).status, "maintenance");
  });

  test("vehicle availability update failure rolls back readiness confirmation", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    const constraintName = `readiness_availability_failure_${randomBytes(6).toString("hex")}`;
    assert.ok(Number.isSafeInteger(vehicleId) && vehicleId > 0);
    await pool.query(`ALTER TABLE public.vehicles ADD CONSTRAINT ${constraintName}
      CHECK (vehicle_id <> ${vehicleId} OR status <> 'available') NOT VALID`);
    try {
      await assert.rejects(confirmVehicleReady(vehicleId, maintenance.maintenance_id), error =>
        error.code === "23514" && error.constraint === constraintName);
      assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], maintenance);
      assert.deepEqual(await getVehicleState(vehicleId), { status: "maintenance", assigned_driver_id: null, current_odometer: 1200 });
    } finally {
      await pool.query(`ALTER TABLE public.vehicles DROP CONSTRAINT ${constraintName}`);
    }
    const result = await confirmVehicleReady(vehicleId, maintenance.maintenance_id);
    assert.equal(result.vehicle.status, "available");
    assert.ok(result.maintenance.ready_confirmed_at instanceof Date);
  });

  test("concurrent readiness confirmations succeed only once", async () => {
    const vehicleId = await createVehicle();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    const results = await Promise.allSettled([
      confirmVehicleReady(vehicleId, maintenance.maintenance_id),
      confirmVehicleReady(vehicleId, maintenance.maintenance_id),
    ]);
    const successful = results.filter(result => result.status === "fulfilled");
    const rejected = results.filter(result => result.status === "rejected");
    assert.equal(successful.length, 1);
    assert.equal(rejected.length, 1);
    assert.ok(rejected[0].reason instanceof MaintenanceError);
    assert.equal(rejected[0].reason.status, 409);
    assert.deepEqual((await getMaintenanceRecords(vehicleId))[0], successful[0].value.maintenance);
    assert.equal((await getVehicleState(vehicleId)).status, "available");
  });

  test("concurrent readiness confirmation and assignment preserve vehicle state", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();
    const maintenance = await completeVehicleMaintenance(vehicleId);
    const [readiness, assignment] = await Promise.allSettled([
      confirmVehicleReady(vehicleId, maintenance.maintenance_id), assignVehicle(vehicleId, driverId),
    ]);
    assert.equal(readiness.status, "fulfilled");
    assert.ok((await getMaintenanceRecords(vehicleId))[0].ready_confirmed_at instanceof Date);
    const history = await getAssignmentHistory(vehicleId);
    if (assignment.status === "fulfilled") {
      assert.deepEqual(await getVehicleState(vehicleId), { status: "in use", assigned_driver_id: driverId, current_odometer: 1200 });
      assert.equal(history.length, 1);
      assert.equal(history[0].driver_employee_id, driverId);
      assert.equal(history[0].unassigned_at, null);
    } else {
      assert.ok(assignment.reason instanceof AssignmentError);
      assert.equal(assignment.reason.status, 409);
      assert.equal(history.length, 0);
      assert.deepEqual(await getVehicleState(vehicleId), { status: "available", assigned_driver_id: null, current_odometer: 1200 });
    }
  });
}
