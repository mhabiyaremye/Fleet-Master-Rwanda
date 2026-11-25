const express = require("express");
const router = express.Router();
const pool = require("./src/config/database.js");

const { authenticateUser, authorizeRoles } = require("./src/middleware/authentication.js");
const {
  startMaintenance,
  updateMaintenance,
  confirmVehicleReady,
  MaintenanceError,
} = require("./services/vehicle-maintenance-service.js");

// Only Fleet Managers can access maintenance endpoints.
router.use(authenticateUser, authorizeRoles("Fleet Manager"));

// Start maintenance for a vehicle.

router.post("/:vehicle_id/maintenance", async function (req, res) {
  try {
    const maintenance = await startMaintenance(
      req.params.vehicle_id,
      req.body
    );

    return res.status(201).json({
      success: true,
      message: "Maintenance started successfully",
      maintenance,
    });

  } catch (error) {
    if (error instanceof MaintenanceError) {
      return res.status(error.status).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Failed to start maintenance:",
      error.code || error.name
    );

    return res.status(500).json({
      success: false,
      message: "Failed to start maintenance",
    });
  }
});


// Retrieve a vehicle's maintenance history.
router.get("/:vehicle_id/maintenance", async function (req, res) {
  const vehicleId = Number(req.params.vehicle_id);

  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid vehicle ID",
    });
  }

  try {
    const result = await pool.query(
      `SELECT *
             FROM maintenance_records
             WHERE vehicle_id = $1
             ORDER BY maintenance_date DESC, maintenance_id DESC`,
      [vehicleId],
    );

    return res.status(200).json({
      success: true,
      maintenance_records: result.rows,
    });
  } catch (error) {
    console.error("Failed to retrieve maintenance history:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve maintenance history",
    });
  }
});

// Update an existing maintenance record.
router.patch(
  "/:vehicle_id/maintenance/:maintenance_id",
  async function (req, res) {
    try {
      const maintenance = await updateMaintenance(
        req.params.vehicle_id,
        req.params.maintenance_id,
        req.body
      );

      return res.status(200).json({
        success: true,
        message: "Maintenance record updated successfully",
        maintenance,
      });
    } catch (error) {
      if (error instanceof MaintenanceError) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }

      console.error(
        "Failed to update maintenance:",
        error.code || error.name
      );

      return res.status(500).json({
        success: false,
        message: "Failed to update maintenance record",
      });
    }
  },
);

// Confirm that a vehicle is ready to return to service.
router.patch(
  "/:vehicle_id/maintenance/:maintenance_id/confirm-ready",
  async function (req, res) {
    try {
      const { maintenance, vehicle } = await confirmVehicleReady(
        req.params.vehicle_id,
        req.params.maintenance_id
      );

      return res.status(200).json({
        success: true,
        message: "Vehicle readiness confirmed successfully",
        maintenance,
        vehicle,
      });
    } catch (error) {
      if (error instanceof MaintenanceError) {
        return res.status(error.status).json({
          success: false,
          message: error.message,
        });
      }

      console.error("Failed to confirm vehicle readiness:", error.code || error.name);
      return res.status(500).json({
        success: false,
        message: "Failed to confirm vehicle readiness",
      });
    }
  },
);

module.exports = router;
