
"use strict";

const express = require("express");
const router = express.Router();

const pool = require("../../config/database.js");

const {
  authenticateUser,
  authorizeRoles,
} = require("../../middleware/authentication.js");

const {
  assignVehicle,
  unassignVehicle,
  AssignmentError,
} = require("../assignments/assignment.service.js");

const MAX_INTEGER = 2147483647;
const MIN_VEHICLE_YEAR = 1980;

// All routes require an authenticated Fleet Manager.
router.use(
  authenticateUser,
  authorizeRoles("Fleet Manager")
);

/**
 * Parse a positive PostgreSQL INTEGER identifier.
 * Rejects decimals, negative numbers, zero,
 * scientific notation and malformed strings.
 */
function parsePositiveId(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null;
  }

  const raw = String(value);

  if (!/^[1-9]\d*$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed > MAX_INTEGER
  ) {
    return null;
  }

  return parsed;
}

/**
 * Parse a non-negative PostgreSQL INTEGER.
 */
function parseNonNegativeInteger(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null;
  }

  const raw = String(value);

  if (!/^(0|[1-9]\d*)$/.test(raw)) {
    return null;
  }

  const parsed = Number(raw);

  if (
    !Number.isSafeInteger(parsed) ||
    parsed > MAX_INTEGER
  ) {
    return null;
  }

  return parsed;
}

/**
 * Validate a required text field.
 */
function validateText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  if (
    cleaned.length === 0 ||
    cleaned.length > maxLength
  ) {
    return null;
  }

  return cleaned;
}

/**
 * Translate service and PostgreSQL errors
 * into safe HTTP responses.
 */
function handleRouteError(res, error, operation) {
  if (error instanceof AssignmentError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
    });
  }

  // Unique constraint violation.
  if (error.code === "23505") {
    return res.status(409).json({
      success: false,
      message:
        "A conflicting vehicle or driver assignment already exists.",
    });
  }

  // Foreign-key constraint violation.
  if (error.code === "23503") {
    return res.status(409).json({
      success: false,
      message:
        "The operation conflicts with an existing database relationship.",
    });
  }

  // PostgreSQL serialization failure or deadlock.
  if (
    error.code === "40001" ||
    error.code === "40P01"
  ) {
    return res.status(503).json({
      success: false,
      message:
        "The operation could not be completed due to concurrent activity. Please try again.",
    });
  }

  console.error(`Vehicle ${operation} error:`, error);

  return res.status(500).json({
    success: false,
    message: `Failed to ${operation} vehicle.`,
  });
}

/**
 * POST /
 *
 * Create a new vehicle.
 */
router.post("/", async function (req, res) {
  const body = req.body || {};

  const {
    plate_number,
    make,
    model,
    year,
    current_odometer,
  } = body;

  const plateNumber = validateText(plate_number, 30);
  const vehicleMake = validateText(make, 100);
  const vehicleModel = validateText(model, 100);

  const vehicleYear = parsePositiveId(year);

  const odometer = parseNonNegativeInteger(
    current_odometer
  );

  const currentYear = new Date().getFullYear();

  if (
    !plateNumber ||
    !vehicleMake ||
    !vehicleModel ||
    vehicleYear === null ||
    odometer === null
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Valid plate number, make, model, year and odometer are required.",
    });
  }

  if (
    vehicleYear < MIN_VEHICLE_YEAR ||
    vehicleYear > currentYear + 1
  ) {
    return res.status(400).json({
      success: false,
      message:
        "The vehicle manufacturing year is invalid.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.vehicles (
         plate_number,
         make,
         model,
         year,
         current_odometer
       )
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (plate_number) DO NOTHING
       RETURNING *`,
      [
        plateNumber,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        odometer,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message:
          "A vehicle with this plate number already exists.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Vehicle created successfully",
      vehicle: result.rows[0],
    });
  } catch (error) {
    return handleRouteError(
      res,
      error,
      "create"
    );
  }
});

/**
 * GET /
 *
 * Retrieve all vehicles with their
 * currently assigned driver information.
 */
router.get("/", async function (req, res) {
  try {
    const result = await pool.query(
      `SELECT
         v.*,
         u.firstname,
         u.lastname
       FROM public.vehicles AS v
       LEFT JOIN public.users AS u
         ON v.assigned_driver_id = u.employee_id
       ORDER BY v.vehicle_id ASC`
    );

    return res.status(200).json({
      success: true,
      vehicles: result.rows,
    });
  } catch (error) {
    console.error(
      "Vehicle retrieval error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve vehicles",
    });
  }
});

/**
 * GET /approved-employees
 *
 * Retrieve approved employees who hold
 * the Driver role.
 *
 * Existing response structure is preserved.
 */
router.get(
  "/approved-employees",
  async function (req, res) {
    try {
      const result = await pool.query(
        `SELECT
           employee_id,
           firstname,
           lastname
         FROM public.users
         WHERE status = 'approved'
           AND role = 'Driver'
         ORDER BY firstname ASC, lastname ASC`
      );

      return res.status(200).json({
        success: true,
        employees: result.rows,
      });
    } catch (error) {
      console.error(
        "Approved employees retrieval error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Failed to retrieve approved employees",
      });
    }
  }
);

/**
 * PATCH /:vehicle_id/assign
 *
 * Assign an approved driver to an available vehicle.
 *
 * The service updates current assignment and
 * inserts assignment history atomically.
 */
router.patch(
  "/:vehicle_id/assign",
  async function (req, res) {
    const vehicleId = parsePositiveId(
      req.params.vehicle_id
    );

   const employeeId =
  typeof req.body?.employee_id === "string"
    ? req.body.employee_id.trim()
    : null;

    if (vehicleId === null) {
      return res.status(400).json({
        success: false,
        message:
          "A valid vehicle id is required.",
      });
    }

  if (
  employeeId === null ||
  employeeId.length === 0 ||
  employeeId.length > 255
) {
  return res.status(400).json({
    success: false,
    message:
      "A valid driver employee ID is required.",
  });
}
    try {
      const vehicle = await assignVehicle(
        vehicleId,
        employeeId
      );

      return res.status(200).json({
        success: true,
        message:
          "Vehicle assigned successfully",
        vehicle,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "assign"
      );
    }
  }
);

/**
 * PATCH /:vehicle_id/unassign
 *
 * Unassign the current driver.
 *
 * The service closes the active history record
 * and updates the vehicle in one transaction.
 */
router.patch(
  "/:vehicle_id/unassign",
  async function (req, res) {
    const vehicleId = parsePositiveId(
      req.params.vehicle_id
    );

    if (vehicleId === null) {
      return res.status(400).json({
        success: false,
        message:
          "A valid vehicle id is required.",
      });
    }

    try {
      const vehicle = await unassignVehicle(
        vehicleId,
        "manual"
      );

      return res.status(200).json({
        success: true,
        message:
          "Vehicle unassigned successfully",
        vehicle,
      });
    } catch (error) {
      return handleRouteError(
        res,
        error,
        "unassign"
      );
    }
  }
);

module.exports = router;
