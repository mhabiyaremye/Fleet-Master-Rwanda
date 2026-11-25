"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { loadEnvFile } = require("node:process");
const { randomBytes } = require("node:crypto");

if (process.env.RUN_MAINTENANCE_INTEGRATION !== "1") {
  test(
    "PostgreSQL maintenance integration (opt-in)",
    { skip: true },
    () => {}
  );
} else {
  loadEnvFile(path.resolve(__dirname, "../../.env"));

  const TEST_DB = "fleet_master_assignment_test";
  process.env.db_name = TEST_DB;

  const pool = require("../database.js");

  const {
    startMaintenance,
    MaintenanceError,
  } = require("../services/vehicle-maintenance-service.js");

  const {
    assignVehicle,
    AssignmentError,
  } = require("../services/vehicle-assignment-service.js");

  const fixturePrefix = `MT-${randomBytes(6).toString("hex")}`;

  const vehicleIds = [];
  const driverIds = [];

  let databaseVerified = false;
  let fixtureCounter = 0;

  before(async () => {
    const { rows } = await pool.query(
      "SELECT current_database() AS name"
    );

    assert.equal(rows[0].name, TEST_DB);
    databaseVerified = true;
  });

  after(async () => {
    try {
      if (databaseVerified) {
        const client = await pool.connect();

        try {
          await client.query("BEGIN");

          await client.query(
            `DELETE FROM public.maintenance_records
             WHERE vehicle_id = ANY($1::int[])`,
            [vehicleIds]
          );

          await client.query(
            `DELETE FROM public.vehicle_assignment_history
             WHERE vehicle_id = ANY($1::int[])`,
            [vehicleIds]
          );

          await client.query(
            `DELETE FROM public.vehicles
             WHERE vehicle_id = ANY($1::int[])`,
            [vehicleIds]
          );

          await client.query(
            `DELETE FROM public.users
             WHERE employee_id = ANY($1::text[])`,
            [driverIds]
          );

          await client.query("COMMIT");
        } catch (error) {
          try {
            await client.query("ROLLBACK");
          } catch {
            // Preserve the original error.
          }

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
    const plateNumber =
      `${fixturePrefix}${(++fixtureCounter).toString(36)}`;

    const { rows } = await pool.query(
      `INSERT INTO public.vehicles (
         plate_number, make, model, year,
         status, current_odometer
       )
       VALUES ($1, 'Toyota', 'Test', 2022,
               'available', 1000)
       RETURNING vehicle_id`,
      [plateNumber]
    );

    const vehicleId = rows[0].vehicle_id;
    vehicleIds.push(vehicleId);

    return vehicleId;
  }

  async function createDriver() {
    const employeeId =
      `${fixturePrefix}-${++fixtureCounter}`;

    await pool.query(
      `INSERT INTO public.users (
         email, password, employee_id,
         firstname, lastname, role, status
       )
       VALUES (
         $1, $2, $3,
         'Integration', 'Fixture',
         'Driver', 'approved'
       )`,
      [
        `${employeeId}@example.invalid`,
        "not-a-login-credential",
        employeeId,
      ]
    );

    driverIds.push(employeeId);

    return employeeId;
  }

  function maintenanceDetails(overrides = {}) {
    return {
      maintenance_type: "Preventive maintenance",
      description: "Engine oil and filter replacement",
      maintenance_date: new Date()
        .toISOString()
        .slice(0, 10),
      odometer_reading: 1200,
      cost: "15000.00",
      ...overrides,
    };
  }

  async function getVehicleState(vehicleId) {
    const { rows } = await pool.query(
      `SELECT status, assigned_driver_id,
              current_odometer
       FROM public.vehicles
       WHERE vehicle_id = $1`,
      [vehicleId]
    );

    return rows[0];
  }

  async function getMaintenanceRecords(vehicleId) {
    const { rows } = await pool.query(
      `SELECT *
       FROM public.maintenance_records
       WHERE vehicle_id = $1
       ORDER BY maintenance_id`,
      [vehicleId]
    );

    return rows;
  }

  async function getAssignmentHistory(vehicleId) {
    const { rows } = await pool.query(
      `SELECT *
       FROM public.vehicle_assignment_history
       WHERE vehicle_id = $1
       ORDER BY assignment_id`,
      [vehicleId]
    );

    return rows;
  }

  function rejectsMaintenance(promise, status) {
    return assert.rejects(
      promise,
      error =>
        error instanceof MaintenanceError &&
        error.status === status
    );
  }

  test("available vehicle enters maintenance", async () => {
    const vehicleId = await createVehicle();

    const record = await startMaintenance(
      vehicleId,
      maintenanceDetails()
    );

    assert.equal(record.vehicle_id, vehicleId);
    assert.equal(record.status, "in progress");
    assert.equal(record.completed_at, null);
    assert.equal(record.ready_confirmed_at, null);

    assert.deepEqual(await getVehicleState(vehicleId), {
      status: "maintenance",
      assigned_driver_id: null,
      current_odometer: 1200,
    });

    assert.equal(
      (await getMaintenanceRecords(vehicleId)).length,
      1
    );
  });

  test("maintenance closes assignment and releases driver", async () => {
    const vehicleId = await createVehicle();
    const replacementVehicleId = await createVehicle();
    const driverId = await createDriver();

    await assignVehicle(vehicleId, driverId);

    await startMaintenance(
      vehicleId,
      maintenanceDetails()
    );

    const history = await getAssignmentHistory(vehicleId);

    assert.equal(history.length, 1);
    assert.equal(history[0].driver_employee_id, driverId);
    assert.ok(history[0].unassigned_at instanceof Date);
    assert.ok(
      history[0].unassigned_at >= history[0].assigned_at
    );
    assert.equal(
      history[0].unassignment_reason,
      "maintenance"
    );

    const vehicle = await getVehicleState(vehicleId);

    assert.equal(vehicle.status, "maintenance");
    assert.equal(vehicle.assigned_driver_id, null);

    await assignVehicle(replacementVehicleId, driverId);

    assert.equal(
      (await getVehicleState(replacementVehicleId))
        .assigned_driver_id,
      driverId
    );
  });

  test("duplicate maintenance request is rejected", async () => {
    const vehicleId = await createVehicle();

    await startMaintenance(
      vehicleId,
      maintenanceDetails()
    );

    await rejectsMaintenance(
      startMaintenance(vehicleId, maintenanceDetails()),
      409
    );

    assert.equal(
      (await getMaintenanceRecords(vehicleId)).length,
      1
    );
  });

  test("vehicle under maintenance cannot be assigned", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();

    await startMaintenance(
      vehicleId,
      maintenanceDetails()
    );

    await assert.rejects(
      assignVehicle(vehicleId, driverId),
      error =>
        error instanceof AssignmentError &&
        error.status === 409
    );

    assert.equal(
      (await getAssignmentHistory(vehicleId)).length,
      0
    );

    assert.equal(
      (await getVehicleState(vehicleId)).status,
      "maintenance"
    );
  });

  test("invalid maintenance details are rejected", async () => {
    const vehicleId = await createVehicle();

    const invalidDetails = [
      { maintenance_type: "" },
      { description: " " },
      { maintenance_date: "2026-02-30" },
      { odometer_reading: -1 },
      { odometer_reading: null },
      { cost: "-100" },
      { cost: "100.999" },
    ];

    for (const details of invalidDetails) {
      await rejectsMaintenance(
        startMaintenance(
          vehicleId,
          maintenanceDetails(details)
        ),
        400
      );
    }

    assert.equal(
      (await getMaintenanceRecords(vehicleId)).length,
      0
    );

    assert.equal(
      (await getVehicleState(vehicleId)).status,
      "available"
    );
  });

  test("maintenance cannot decrease vehicle odometer", async () => {
    const vehicleId = await createVehicle();

    await rejectsMaintenance(
      startMaintenance(
        vehicleId,
        maintenanceDetails({ odometer_reading: 999 })
      ),
      400
    );

    assert.deepEqual(await getVehicleState(vehicleId), {
      status: "available",
      assigned_driver_id: null,
      current_odometer: 1000,
    });

    assert.equal(
      (await getMaintenanceRecords(vehicleId)).length,
      0
    );
  });

  test("missing assignment history prevents maintenance", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();

    await pool.query(
      `UPDATE public.vehicles
       SET status = 'in use',
           assigned_driver_id = $1
       WHERE vehicle_id = $2`,
      [driverId, vehicleId]
    );

    await rejectsMaintenance(
      startMaintenance(vehicleId, maintenanceDetails()),
      409
    );

    assert.deepEqual(await getVehicleState(vehicleId), {
      status: "in use",
      assigned_driver_id: driverId,
      current_odometer: 1000,
    });

    assert.equal(
      (await getMaintenanceRecords(vehicleId)).length,
      0
    );
  });

  test("database rejects duplicate active maintenance", async () => {
    const vehicleId = await createVehicle();

    await startMaintenance(
      vehicleId,
      maintenanceDetails()
    );

    await assert.rejects(
      pool.query(
        `INSERT INTO public.maintenance_records (
           vehicle_id, maintenance_type, description,
           maintenance_date, odometer_reading, cost
         )
         SELECT vehicle_id, maintenance_type, description,
                maintenance_date, odometer_reading, cost
         FROM public.maintenance_records
         WHERE vehicle_id = $1
           AND status = 'in progress'`,
        [vehicleId]
      ),
      error =>
        error.code === "23505" &&
        error.constraint ===
          "idx_one_active_maintenance_per_vehicle"
    );

    assert.equal(
      (await getMaintenanceRecords(vehicleId)).length,
      1
    );
  });

  test("database rejects negative vehicle odometer", async () => {
    const vehicleId = await createVehicle();

    await assert.rejects(
      pool.query(
        `UPDATE public.vehicles
         SET current_odometer = -1
         WHERE vehicle_id = $1`,
        [vehicleId]
      ),
      error =>
        error.code === "23514" &&
        error.constraint ===
          "chk_vehicle_current_odometer_nonnegative"
    );

    assert.equal(
      (await getVehicleState(vehicleId)).current_odometer,
      1000
    );
  });

  test("maintenance insertion failure rolls back assignment closure", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();

    await assignVehicle(vehicleId, driverId);

    const constraintName =
      `mt_insert_failure_${randomBytes(6).toString("hex")}`;

    assert.ok(
      Number.isSafeInteger(vehicleId) && vehicleId > 0
    );

    await pool.query(
      `ALTER TABLE public.maintenance_records
       ADD CONSTRAINT ${constraintName}
       CHECK (vehicle_id <> ${vehicleId}) NOT VALID`
    );

    try {
      await assert.rejects(
        startMaintenance(vehicleId, maintenanceDetails()),
        error =>
          error.code === "23514" &&
          error.constraint === constraintName
      );

      assert.deepEqual(await getVehicleState(vehicleId), {
        status: "in use",
        assigned_driver_id: driverId,
        current_odometer: 1000,
      });

      const history = await getAssignmentHistory(vehicleId);

      assert.equal(history.length, 1);
      assert.equal(history[0].unassigned_at, null);
      assert.equal(history[0].unassignment_reason, null);

      assert.equal(
        (await getMaintenanceRecords(vehicleId)).length,
        0
      );
    } finally {
      await pool.query(
        `ALTER TABLE public.maintenance_records
         DROP CONSTRAINT ${constraintName}`
      );
    }

    await startMaintenance(
      vehicleId,
      maintenanceDetails()
    );

    assert.equal(
      (await getVehicleState(vehicleId)).status,
      "maintenance"
    );
  });

  test("concurrent maintenance requests create one active record", async () => {
    const vehicleId = await createVehicle();

    const results = await Promise.allSettled([
      startMaintenance(vehicleId, maintenanceDetails()),
      startMaintenance(vehicleId, maintenanceDetails()),
    ]);

    const successful = results.filter(
      result => result.status === "fulfilled"
    );

    const rejected = results.filter(
      result => result.status === "rejected"
    );

    assert.equal(successful.length, 1);
    assert.equal(rejected.length, 1);

    assert.ok(
      rejected[0].reason instanceof MaintenanceError
    );

    assert.equal(rejected[0].reason.status, 409);

    assert.equal(
      (await getMaintenanceRecords(vehicleId)).length,
      1
    );

    assert.equal(
      (await getVehicleState(vehicleId)).status,
      "maintenance"
    );
  });

  test("concurrent assignment and maintenance preserve vehicle state", async () => {
    const vehicleId = await createVehicle();
    const driverId = await createDriver();

    const [assignment, maintenance] =
      await Promise.allSettled([
        assignVehicle(vehicleId, driverId),
        startMaintenance(vehicleId, maintenanceDetails()),
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

      assert.equal(
        history[0].unassignment_reason,
        "maintenance"
      );
    } else {
      assert.ok(
        assignment.reason instanceof AssignmentError
      );

      assert.equal(assignment.reason.status, 409);
      assert.equal(history.length, 0);
    }

    assert.equal(
      (await getMaintenanceRecords(vehicleId)).length,
      1
    );
  });
}

