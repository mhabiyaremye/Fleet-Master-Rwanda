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
async function updateMaintenance(id, recordId, body = {}) {
  const vehicleId = integer(id, 1);
  const maintenanceId = integer(recordId, 1);

  const {
    maintenance_type: type,
    description,
    maintenance_date: date,
    odometer_reading: reading,
    cost,
    status,
  } = body || {};

  if (vehicleId === null || maintenanceId === null) {
    throw new MaintenanceError(
      "Invalid vehicle ID or maintenance ID",
      400
    );
  }

  const odometer =
    reading === undefined ? undefined : integer(reading, 0);

  const validDate =
    date === undefined ||
    (
      typeof date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !date.startsWith("0000") &&
      !Number.isNaN(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date
    );

  if (
    (type !== undefined &&
      (typeof type !== "string" ||
        !type.trim() ||
        type.trim().length > 100)) ||
    (description !== undefined &&
      (typeof description !== "string" ||
        !description.trim())) ||
    !validDate ||
    odometer === null ||
    (cost !== undefined &&
      (!["number", "string"].includes(typeof cost) ||
        !/^\d{1,10}(\.\d{1,2})?$/.test(String(cost)))) ||
    (status !== undefined &&
      !["in progress", "completed"].includes(status))
  ) {
    throw new MaintenanceError(
      "One or more maintenance fields are invalid",
      400
    );
  }

  if (
    [type, description, date, reading, cost, status]
      .every(value => value === undefined)
  ) {
    throw new MaintenanceError(
      "Provide at least one field to update",
      400
    );
  }

  const client = await pool.connect();

  let started = false;
  let discard = false;

  try {
    await client.query("BEGIN");
    started = true;

    // Lock the vehicle before the maintenance record.
    const {
      rows: [vehicle],
    } = await client.query(
      `SELECT vehicle_id, status, current_odometer,
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

    const {
      rows: [maintenance],
    } = await client.query(
      `SELECT *
       FROM public.maintenance_records
       WHERE maintenance_id = $1
         AND vehicle_id = $2
       FOR UPDATE`,
      [maintenanceId, vehicleId]
    );

    if (!maintenance) {
      throw new MaintenanceError(
        "Maintenance record not found for this vehicle",
        404
      );
    }

    if (maintenance.status !== "in progress") {
      throw new MaintenanceError(
        "Only maintenance records in progress can be updated"
      );
    }

    if (
      vehicle.status !== "maintenance" ||
      vehicle.assigned_driver_id !== null
    ) {
      throw new MaintenanceError(
        "Vehicle maintenance state is inconsistent"
      );
    }

    const activeAssignment = await client.query(
      `SELECT assignment_id
       FROM public.vehicle_assignment_history
       WHERE vehicle_id = $1
         AND unassigned_at IS NULL
       FOR UPDATE`,
      [vehicleId]
    );

    if (activeAssignment.rowCount > 0) {
      throw new MaintenanceError(
        "Vehicle has an unresolved driver assignment"
      );
    }

    if (
      odometer !== undefined &&
      odometer < Math.max(
        vehicle.current_odometer,
        maintenance.odometer_reading
      )
    ) {
      throw new MaintenanceError(
        "Maintenance odometer reading cannot decrease",
        400
      );
    }

    const nextStatus = status ?? maintenance.status;

    const updatedMaintenance = await client.query(
      `UPDATE public.maintenance_records
       SET maintenance_type = COALESCE($1, maintenance_type),
           description = COALESCE($2, description),
           maintenance_date = COALESCE($3, maintenance_date),
           odometer_reading = COALESCE($4, odometer_reading),
           cost = COALESCE($5, cost),
           status = $6::varchar,
           completed_at = CASE
             WHEN $6::varchar = 'completed'
               THEN CURRENT_TIMESTAMP
             ELSE completed_at
           END
       WHERE maintenance_id = $7
         AND vehicle_id = $8
       RETURNING *`,
      [
        type?.trim() ?? null,
        description?.trim() ?? null,
        date ?? null,
        odometer ?? null,
        cost === undefined ? null : String(cost),
        nextStatus,
        maintenanceId,
        vehicleId,
      ]
    );

    if (updatedMaintenance.rowCount !== 1) {
      throw new MaintenanceError(
        "Unable to update maintenance record"
      );
    }

    // Keep the vehicle odometer synchronized.
    const updatedVehicle = await client.query(
      `UPDATE public.vehicles
       SET current_odometer =
             GREATEST(current_odometer, $1),
           updated_at = CURRENT_TIMESTAMP
       WHERE vehicle_id = $2`,
      [
        updatedMaintenance.rows[0].odometer_reading,
        vehicleId,
      ]
    );

    if (updatedVehicle.rowCount !== 1) {
      throw new MaintenanceError(
        "Unable to update vehicle odometer"
      );
    }

    try {
      await client.query("COMMIT");
      started = false;
    } catch (error) {
      discard = true;
      throw error;
    }

    return updatedMaintenance.rows[0];

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


async function confirmVehicleReady(id, recordId) {
  const vehicleId = integer(id, 1);
  const maintenanceId = integer(recordId, 1);

  if (vehicleId === null || maintenanceId === null) {
    throw new MaintenanceError("Invalid vehicle ID or maintenance ID", 400);
  }

  const client = await pool.connect();
  let started = false;
  let discard = false;

  try {
    await client.query("BEGIN");
    started = true;

    // Use the same vehicle-first lock order as maintenance updates.
    const { rows: [vehicle] } = await client.query(
      `SELECT vehicle_id, status, assigned_driver_id
       FROM public.vehicles
       WHERE vehicle_id = $1
       FOR UPDATE`,
      [vehicleId]
    );

    if (!vehicle) {
      throw new MaintenanceError("Vehicle not found", 404);
    }

    const { rows: [maintenance] } = await client.query(
      `SELECT maintenance_id, vehicle_id, status, ready_confirmed_at
       FROM public.maintenance_records
       WHERE maintenance_id = $1 AND vehicle_id = $2
       FOR UPDATE`,
      [maintenanceId, vehicleId]
    );

    if (!maintenance) {
      throw new MaintenanceError("Maintenance record not found for this vehicle", 404);
    }

    if (maintenance.status !== "completed") {
      throw new MaintenanceError("Maintenance must be completed before confirming readiness");
    }

    const { rows: [latestMaintenance] } = await client.query(
      `SELECT maintenance_id
       FROM public.maintenance_records
       WHERE vehicle_id = $1 AND status <> 'cancelled'
       ORDER BY created_at DESC, maintenance_id DESC
       LIMIT 1
       FOR UPDATE`,
      [vehicleId]
    );

    if (!latestMaintenance || latestMaintenance.maintenance_id !== maintenanceId) {
      throw new MaintenanceError(
        "Only the latest non-cancelled maintenance record can be used to confirm readiness"
      );
    }

    const activeMaintenance = await client.query(
      `SELECT maintenance_id
       FROM public.maintenance_records
       WHERE vehicle_id = $1 AND status = 'in progress'
       FOR UPDATE`,
      [vehicleId]
    );

    if (activeMaintenance.rowCount > 0) {
      throw new MaintenanceError("Vehicle has another maintenance record in progress");
    }

    if (maintenance.ready_confirmed_at !== null) {
      throw new MaintenanceError("Vehicle readiness has already been confirmed for this record");
    }

    if (vehicle.status !== "maintenance") {
      throw new MaintenanceError("Vehicle must be in maintenance status before confirming readiness");
    }

    const activeAssignment = await client.query(
      `SELECT assignment_id
       FROM public.vehicle_assignment_history
       WHERE vehicle_id = $1 AND unassigned_at IS NULL
       FOR UPDATE`,
      [vehicleId]
    );

    if (vehicle.assigned_driver_id !== null || activeAssignment.rowCount > 0) {
      throw new MaintenanceError("Vehicle assignment state is inconsistent");
    }

    // Record the actual confirmation time, after any wait for the locks.
    const updatedMaintenance = await client.query(
      `UPDATE public.maintenance_records
       SET ready_confirmed_at = clock_timestamp()
       WHERE maintenance_id = $1 AND vehicle_id = $2
       RETURNING *`,
      [maintenanceId, vehicleId]
    );

    if (updatedMaintenance.rowCount !== 1) {
      throw new MaintenanceError("Unable to confirm maintenance readiness");
    }

    const updatedVehicle = await client.query(
      `UPDATE public.vehicles
       SET status = 'available', updated_at = CURRENT_TIMESTAMP
       WHERE vehicle_id = $1
       RETURNING vehicle_id, plate_number, status`,
      [vehicleId]
    );

    if (updatedVehicle.rowCount !== 1) {
      throw new MaintenanceError("Unable to return vehicle to service");
    }

    try {
      await client.query("COMMIT");
      started = false;
    } catch (error) {
      discard = true;
      throw error;
    }

    return {
      maintenance: updatedMaintenance.rows[0],
      vehicle: updatedVehicle.rows[0],
    };
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
    client.release(discard ? new Error("Uncertain transaction connection") : undefined);
  }
}

module.exports = {
  startMaintenance,
  updateMaintenance,
  confirmVehicleReady,
  MaintenanceError,
};
