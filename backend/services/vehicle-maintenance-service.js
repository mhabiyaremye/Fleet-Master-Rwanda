
"use strict";

const pool = require("../database.js");

const MAX_ID = 2147483647;

class MaintenanceError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.name = "MaintenanceError";
    this.status = status;
  }
}

function integer(value, min) {
  if (
    !["string", "number"].includes(typeof value) ||
    !/^(0|[1-9]\d*)$/.test(String(value))
  ) {
    return null;
  }

  const n = Number(value);

  return Number.isSafeInteger(n) &&
    n >= min &&
    n <= MAX_ID
    ? n
    : null;
}

async function startMaintenance(id, body = {}) {
  const vehicleId = integer(id, 1);

  const {
    maintenance_type: type,
    description,
    maintenance_date: date,
    odometer_reading: reading,
    cost = 0,
  } = body || {};

  const odometer = integer(reading, 0);

  const validDate =
    typeof date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    !date.startsWith("0000") &&
    !Number.isNaN(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;

  if (
    vehicleId === null ||
    typeof type !== "string" ||
    !type.trim() ||
    type.trim().length > 100 ||
    typeof description !== "string" ||
    !description.trim() ||
    odometer === null ||
    !validDate ||
    !["number", "string"].includes(typeof cost) ||
    !/^\d{1,10}(\.\d{1,2})?$/.test(String(cost))
  ) {
    throw new MaintenanceError(
      "Provide valid maintenance details, date, odometer and cost (up to two decimal places).",
      400
    );
  }

  const client = await pool.connect();

  let started = false;
  let discard = false;

  try {
    await client.query("BEGIN");
    started = true;

    // Lock the vehicle.

    const {
      rows: [vehicle],
    } = await client.query(
      `SELECT vehicle_id,
              status,
              current_odometer,
              assigned_driver_id
       FROM public.vehicles
       WHERE vehicle_id = $1
       FOR UPDATE`,
      [vehicleId]
    );

    if (!vehicle) {
      throw new MaintenanceError(
        "Vehicle not found",
        404
      );
    }

    if (!["available", "in use"].includes(vehicle.status)) {
      throw new MaintenanceError(
        "This vehicle cannot start maintenance in its current status"
      );
    }

    if (odometer < vehicle.current_odometer) {
      throw new MaintenanceError(
        "Maintenance odometer reading cannot be below the vehicle's current odometer",
        400
      );
    }

    // Prevent duplicate active maintenance.

    const active = await client.query(
      `SELECT maintenance_id
       FROM public.maintenance_records
       WHERE vehicle_id = $1
         AND status = 'in progress'`,
      [vehicleId]
    );

    if (active.rowCount > 0) {
      throw new MaintenanceError(
        "Vehicle already has maintenance in progress"
      );
    }

    // Inspect active assignment history.

    const history = await client.query(
      `SELECT assignment_id, driver_employee_id
       FROM public.vehicle_assignment_history
       WHERE vehicle_id = $1
         AND unassigned_at IS NULL
       FOR UPDATE`,
      [vehicleId]
    );

    // Close the assignment before releasing the driver.

    if (vehicle.status === "in use") {
      if (
        vehicle.assigned_driver_id === null ||
        history.rowCount !== 1 ||
        history.rows[0].driver_employee_id !==
          vehicle.assigned_driver_id
      ) {
        throw new MaintenanceError(
          "Active assignment history is missing or inconsistent"
        );
      }

      const closed = await client.query(
        `UPDATE public.vehicle_assignment_history
         SET unassigned_at =
               GREATEST(CURRENT_TIMESTAMP, assigned_at),
             unassignment_reason = 'maintenance'
         WHERE assignment_id = $1
           AND unassigned_at IS NULL`,
        [history.rows[0].assignment_id]
      );

      if (closed.rowCount !== 1) {
        throw new MaintenanceError(
          "Unable to close active assignment"
        );
      }
    } else if (
      vehicle.assigned_driver_id !== null ||
      history.rowCount !== 0
    ) {
      throw new MaintenanceError(
        "Vehicle assignment state is inconsistent"
      );
    }

    // Create the maintenance record.

    const record = await client.query(
      `INSERT INTO public.maintenance_records (
         vehicle_id,
         maintenance_type,
         description,
         maintenance_date,
         odometer_reading,
         cost
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        vehicleId,
        type.trim(),
        description.trim(),
        date,
        odometer,
        String(cost),
      ]
    );

    // Release the driver and update vehicle status.

    const updated = await client.query(
      `UPDATE public.vehicles
       SET status = 'maintenance',
           assigned_driver_id = NULL,
           current_odometer =
             GREATEST(current_odometer, $1),
           updated_at = CURRENT_TIMESTAMP
       WHERE vehicle_id = $2`,
      [odometer, vehicleId]
    );

    if (updated.rowCount !== 1) {
      throw new MaintenanceError(
        "Unable to update vehicle"
      );
    }

    try {
      await client.query("COMMIT");
      started = false;
    } catch (error) {
      discard = true;
      throw error;
    }

    return record.rows[0];

  } catch (error) {
    if (started && !discard) {
      try {
        await client.query("ROLLBACK");
      } catch {
        discard = true;
      }
    }

    throw error;

  } finally {
    client.release(
      discard
        ? new Error("Uncertain transaction connection")
        : undefined
    );
  }
}

module.exports = {
  startMaintenance,
  MaintenanceError,
};
