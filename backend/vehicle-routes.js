const express = require("express");
const router = express.Router();
const pool = require("./database.js");

const { authenticateUser, authorizeRoles } = require("./auth-middleware.js");

router.use(authenticateUser, authorizeRoles("Fleet Manager"));

router.post("/", async function (req, res) {
  const { plate_number, make, model, year, current_odometer } = req.body;
  const currentYear = new Date().getFullYear();
  if (
    !plate_number ||
    !make ||
    !model ||
    !year ||
    current_odometer === undefined
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }
  if (isNaN(year) || isNaN(current_odometer)) {
    return res.status(400).json({
      success: false,
      message: "Year and current odometer must be valid  numbers",
    });
  }
  if (year < 1980 || year > currentYear + 1) {
    return res.status(400).json({
      success: false,
      message: "The year is not valid",
    });
  }
  if (current_odometer < 0) {
    return res.status(400).json({
      success: false,
      message: "The odometer can not be a negative number",
    });
  }
  try {
    const result = await pool.query(
      `insert into vehicles (
            plate_number,
            make,
            model,
            year,
            current_odometer)
            values(
            $1,$2,$3,$4,$5)
            on conflict(plate_number)do nothing
            returning*`,
      [plate_number, make, model, year, current_odometer],
    );
    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Plate_number already exists",
      });
    }
    return res.status(201).json({
      success: true,
      message: "Vehicle created successfuly",
      vehicle: result.rows[0],
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Database Error",
    });
  }
});
router.get("/", async function (req, res) {
  try {
    const result = await pool.query(`SELECT
    vehicles.*,
    users.firstname,
    users.lastname
  FROM vehicles
  LEFT JOIN users
    ON vehicles.assigned_driver_id = users.employee_id
  ORDER BY vehicles.vehicle_id ASC`);
    return res.status(200).json({
      success: true,
      vehicles: result.rows,
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: "Failed to retreive vehicles",
    });
  }
});
router.get("/approved-employees", async function (req, res) {
  try {
    const result = await pool.query(
      `SELECT employee_id, firstname, lastname
       FROM users
       WHERE status = 'approved'
         AND role = 'Driver'
       ORDER BY firstname ASC`,
    );

    return res.status(200).json({
      success: true,
      employees: result.rows,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve approved employees",
    });
  }
});
router.patch("/:vehicle_id/assign", async function (req, res) {
  try {
    const vehicleId = Number(req.params.vehicle_id);
    const employeeId = req.body && req.body.employee_id;
    const numericEmployeeId = Number(employeeId);

    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid vehicle id is required.",
      });
    }

    if (!Number.isInteger(numericEmployeeId) || numericEmployeeId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid driver id is required.",
      });
    }

    const vehicleResult = await pool.query(
      `select vehicle_id,assigned_driver_id,status from vehicles where
      vehicle_id = $1`,
      [vehicleId],
    );
    if (vehicleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }
    const vehicle = vehicleResult.rows[0];
    if (vehicle.assigned_driver_id) {
      return res.status(409).json({
        success: false,
        message: "Vehicle is already assigned",
      });
    }
    if (
      vehicle.status === "maintenance" ||
      vehicle.status === "out of service"
    ) {
      return res.status(409).json({
        success: false,
        message: "Vehicle is not available for assignment",
      });
    }
    const driverResult = await pool.query(
      `SELECT employee_id
       FROM users
       WHERE employee_id = $1
         AND role = 'Driver'
         AND status = 'approved'`,
      [numericEmployeeId],
    );
    if (driverResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "The selected employee is not an approved driver.",
      });
    }

    const assignmentResult = await pool.query(
      `SELECT vehicle_id
       FROM vehicles
       WHERE assigned_driver_id = $1`,
      [numericEmployeeId],
    );
    if (assignmentResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Driver already assigned",
        driver: numericEmployeeId,
      });
    }

    const result = await pool.query(
      `UPDATE vehicles
   SET assigned_driver_id = $1,
       status = 'in use',
       updated_at = CURRENT_TIMESTAMP
   FROM users
   WHERE vehicles.vehicle_id = $2
     AND users.employee_id = $1
     AND users.role = 'Driver'
     AND users.status = 'approved'
     AND vehicles.assigned_driver_id IS NULL
     AND vehicles.status NOT IN ('maintenance', 'out of service')
     AND NOT EXISTS (
       SELECT 1
       FROM vehicles AS assigned_vehicle
       WHERE assigned_vehicle.assigned_driver_id = users.employee_id
     )
   RETURNING vehicles.*, users.firstname, users.lastname`,
      [numericEmployeeId, vehicleId],
    );

    if (result.rows.length === 0) {
      return res.status(409).json({
        success: false,
        message: "The vehicle or driver is no longer available for assignment.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle assigned successfully",
      vehicle: result.rows[0],
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign vehicle",
    });
  }
});

router.patch("/:vehicle_id/unassign", async function (req, res) {
  try {
    const vehicleId = Number(req.params.vehicle_id);

    if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid vehicle id is required.",
      });
    }

    const result = await pool.query(
      `UPDATE vehicles
       SET assigned_driver_id = NULL,
           status = 'available',
           updated_at = CURRENT_TIMESTAMP
       WHERE vehicle_id = $1
         AND assigned_driver_id IS NOT NULL
         AND status = 'in use'
       RETURNING *`,
      [vehicleId]
    );

    if (result.rows.length === 0) {
      const vehicleResult = await pool.query(
        `SELECT vehicle_id, assigned_driver_id, status
         FROM vehicles
         WHERE vehicle_id = $1`,
        [vehicleId]
      );

      if (vehicleResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      return res.status(409).json({
        success: false,
        message: "Vehicle is not currently assigned and in use.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Vehicle unassigned successfully",
      vehicle: result.rows[0],
    });
  } catch (error) {
    console.error("Vehicle unassignment error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to unassign vehicle",
    });
  }
});

module.exports = router;
