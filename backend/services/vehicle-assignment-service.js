
"use strict";

// ==================================================
// Fleet Master Rwanda
// Vehicle Assignment Service
// ==================================================

const pool = require("../database.js");

// --------------------------------------------------
// Configuration
// --------------------------------------------------

const MAX_INTEGER_ID = 2147483647;
const MAX_REASON_LENGTH = 100;

// Dedicated advisory-lock namespace for driver
// assignment operations.
const ASSIGNMENT_LOCK_NAMESPACE = 750001;

// --------------------------------------------------
// Application errors
// --------------------------------------------------

class AssignmentError extends Error {
  constructor(message, status = 409) {
    super(message);

    this.name = "AssignmentError";
    this.status = status;
    this.statusCode = status;
  }
}

// --------------------------------------------------
// Input validation
// --------------------------------------------------

function validateVehicleId(value) {
  if (
    typeof value !== "number" &&
    typeof value !== "string"
  ) {
    throw new AssignmentError(
      "Invalid vehicle ID.",
      400
    );
  }

  if (
    typeof value === "string" &&
    !/^[1-9]\d*$/.test(value)
  ) {
    throw new AssignmentError(
      "Invalid vehicle ID.",
      400
    );
  }

  const vehicleId = Number(value);

  if (
    !Number.isSafeInteger(vehicleId) ||
    vehicleId <= 0 ||
    vehicleId > MAX_INTEGER_ID
  ) {
    throw new AssignmentError(
      "Invalid vehicle ID.",
      400
    );
  }

  return vehicleId;
}

function validateEmployeeId(value) {
  // Employee IDs are TEXT in the baseline schema.
  // Never convert employee identifiers to numbers.

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new AssignmentError(
      "A valid driver employee ID is required.",
      400
    );
  }

  const employeeId = value.trim();

  if (employeeId.length > 255) {
    throw new AssignmentError(
      "Driver employee ID is too long.",
      400
    );
  }

  return employeeId;
}

function validateReason(value) {
  if (typeof value !== "string") {
    throw new AssignmentError(
      "Unassignment reason must be text.",
      400
    );
  }

  const reason = value.trim();

  if (
    reason.length === 0 ||
    reason.length > MAX_REASON_LENGTH
  ) {
    throw new AssignmentError(
      "Unassignment reason must contain 1 to 100 characters.",
      400
    );
  }

  return reason;
}

// --------------------------------------------------
// PostgreSQL error translation
// --------------------------------------------------

function translateDatabaseError(error) {
  if (error instanceof AssignmentError) {
    return error;
  }

  switch (error.code) {
    case "23505":
      return new AssignmentError(
        "Conflicting active vehicle or driver assignment.",
        409
      );

    case "23503":
      return new AssignmentError(
        "The referenced vehicle or driver does not exist.",
        400
      );

    case "40001":
    case "40P01":
      return new AssignmentError(
        "Assignment transaction conflicted. Please retry.",
        409
      );

    default:
      return error;
  }
}

// --------------------------------------------------
// Transaction management
// --------------------------------------------------

async function withTransaction(work) {
  const client = await pool.connect();

  let transactionStarted = false;
  let discardClient = false;

  try {
    await client.query("BEGIN");
    transactionStarted = true;

    const result = await work(client);

    // A failed COMMIT can leave the outcome uncertain.
    // Do not reuse a connection after a COMMIT error.
    try {
      await client.query("COMMIT");
      transactionStarted = false;
    } catch (commitError) {
      discardClient = true;
      throw commitError;
    }

    return result;

  } catch (error) {
    if (transactionStarted && !discardClient) {
      try {
        await client.query("ROLLBACK");
        transactionStarted = false;
      } catch (rollbackError) {
        discardClient = true;

        console.error(
          "Vehicle assignment rollback failed:",
          rollbackError.message
        );
      }
    }

    throw translateDatabaseError(error);

  } finally {
    if (discardClient) {
      client.release(
        new Error(
          "Discarding uncertain database connection."
        )
      );
    } else {
      client.release();
    }
  }
}

// --------------------------------------------------
// Assign vehicle to driver
// --------------------------------------------------

async function assignVehicle(
  vehicleIdInput,
  employeeIdInput
) {
  const vehicleId = validateVehicleId(
    vehicleIdInput
  );

  const employeeId = validateEmployeeId(
    employeeIdInput
  );

  return withTransaction(async (client) => {

    // ----------------------------------------------
    // Serialize concurrent driver assignments
    // ----------------------------------------------

    // PostgreSQL's two-argument advisory lock takes
    // two INTEGER values.
    //
    // hashtext() converts the TEXT employee ID into
    // an integer lock key. The original employee ID
    // remains unchanged in the database.
    //
    // This lock is released automatically when the
    // transaction commits or rolls back.

    await client.query(
      `SELECT pg_advisory_xact_lock(
         $1::integer,
         hashtext($2::text)
       )`,
      [
        ASSIGNMENT_LOCK_NAMESPACE,
        employeeId
      ]
    );

    // ----------------------------------------------
    // Lock and validate vehicle
    // ----------------------------------------------

    const vehicleResult = await client.query(
      `SELECT
         vehicle_id,
         assigned_driver_id,
         status
       FROM public.vehicles
       WHERE vehicle_id = $1
       FOR UPDATE`,
      [vehicleId]
    );

    if (vehicleResult.rowCount !== 1) {
      throw new AssignmentError(
        "Vehicle not found.",
        404
      );
    }

    const vehicle = vehicleResult.rows[0];

    if (vehicle.assigned_driver_id !== null) {
      throw new AssignmentError(
        "Vehicle is already assigned to a driver.",
        409
      );
    }

    if (vehicle.status !== "available") {
      throw new AssignmentError(
        "Vehicle is not available for assignment.",
        409
      );
    }

    // ----------------------------------------------
    // Verify driver eligibility
    // ----------------------------------------------

    const driverResult = await client.query(
      `SELECT
         employee_id,
         firstname,
         lastname
       FROM public.users
       WHERE employee_id = $1
         AND role = 'Driver'
         AND status = 'approved'
       FOR SHARE`,
      [employeeId]
    );

    if (driverResult.rowCount !== 1) {
      throw new AssignmentError(
        "The selected employee is not an approved driver.",
        400
      );
    }

    // ----------------------------------------------
    // Check existing assignments
    // ----------------------------------------------

    const existingAssignment = await client.query(
      `SELECT vehicle_id
       FROM public.vehicles
       WHERE assigned_driver_id = $1
       LIMIT 1`,
      [employeeId]
    );

    if (existingAssignment.rowCount > 0) {
      throw new AssignmentError(
        "Driver is already assigned to another vehicle.",
        409
      );
    }

    // ----------------------------------------------
    // Detect active history conflicts
    // ----------------------------------------------

    const existingHistory = await client.query(
      `SELECT assignment_id
       FROM public.vehicle_assignment_history
       WHERE unassigned_at IS NULL
         AND (
           vehicle_id = $1
           OR driver_employee_id = $2
         )
       LIMIT 1`,
      [
        vehicleId,
        employeeId
      ]
    );

    if (existingHistory.rowCount > 0) {
      throw new AssignmentError(
        "Active assignment history conflicts with this operation.",
        409
      );
    }

    // ----------------------------------------------
    // Update vehicle
    // ----------------------------------------------

    const updateResult = await client.query(
      `UPDATE public.vehicles
       SET assigned_driver_id = $1,
           status = 'in use',
           updated_at = CURRENT_TIMESTAMP
       WHERE vehicle_id = $2
         AND assigned_driver_id IS NULL
         AND status = 'available'
       RETURNING *`,
      [
        employeeId,
        vehicleId
      ]
    );

    if (updateResult.rowCount !== 1) {
      throw new AssignmentError(
        "Vehicle is no longer available for assignment.",
        409
      );
    }

    // ----------------------------------------------
    // Record permanent assignment history
    // ----------------------------------------------

    // This INSERT and the vehicle UPDATE are
    // part of the same database transaction.

    await client.query(
      `INSERT INTO public.vehicle_assignment_history (
         vehicle_id,
         driver_employee_id,
         assigned_at
       )
       VALUES (
         $1,
         $2,
         CURRENT_TIMESTAMP
       )`,
      [
        vehicleId,
        employeeId
      ]
    );

    const driver = driverResult.rows[0];

    return {
      ...updateResult.rows[0],
      firstname: driver.firstname,
      lastname: driver.lastname
    };
  });
}

// --------------------------------------------------
// Unassign vehicle from driver
// --------------------------------------------------

async function unassignVehicle(
  vehicleIdInput,
  reasonInput = "manual"
) {
  const vehicleId = validateVehicleId(
    vehicleIdInput
  );

  const reason = validateReason(
    reasonInput
  );

  return withTransaction(async (client) => {

    // ----------------------------------------------
    // Lock vehicle
    // ----------------------------------------------

    const vehicleResult = await client.query(
      `SELECT
         vehicle_id,
         assigned_driver_id,
         status
       FROM public.vehicles
       WHERE vehicle_id = $1
       FOR UPDATE`,
      [vehicleId]
    );

    if (vehicleResult.rowCount !== 1) {
      throw new AssignmentError(
        "Vehicle not found.",
        404
      );
    }

    const vehicle = vehicleResult.rows[0];

    if (vehicle.assigned_driver_id === null) {
      throw new AssignmentError(
        "Vehicle is not assigned to a driver.",
        409
      );
    }

    if (vehicle.status !== "in use") {
      throw new AssignmentError(
        "Vehicle status is inconsistent with its active assignment.",
        409
      );
    }

    // ----------------------------------------------
    // Close active assignment history
    // ----------------------------------------------

    const historyResult = await client.query(
      `UPDATE public.vehicle_assignment_history
       SET unassigned_at = CURRENT_TIMESTAMP,
           unassignment_reason = $3
       WHERE vehicle_id = $1
         AND driver_employee_id = $2
         AND unassigned_at IS NULL
       RETURNING assignment_id`,
      [
        vehicleId,
        vehicle.assigned_driver_id,
        reason
      ]
    );

    if (historyResult.rowCount !== 1) {
      throw new AssignmentError(
        "Active assignment history is missing or inconsistent.",
        409
      );
    }

    // ----------------------------------------------
    // Clear vehicle assignment
    // ----------------------------------------------

    const updateResult = await client.query(
      `UPDATE public.vehicles
       SET assigned_driver_id = NULL,
           status = 'available',
           updated_at = CURRENT_TIMESTAMP
       WHERE vehicle_id = $1
         AND assigned_driver_id = $2
         AND status = 'in use'
       RETURNING *`,
      [
        vehicleId,
        vehicle.assigned_driver_id
      ]
    );

    if (updateResult.rowCount !== 1) {
      throw new AssignmentError(
        "Vehicle could not be unassigned.",
        409
      );
    }

    return updateResult.rows[0];
  });
}

// --------------------------------------------------
// Public service API
// --------------------------------------------------

module.exports = {
  assignVehicle,
  unassignVehicle,
  AssignmentError
};
