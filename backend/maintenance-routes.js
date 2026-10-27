const express = require("express");
const router = express.Router();
const pool = require("./database.js");

const { authenticateUser, authorizeRoles } = require("./auth-middleware.js");

// Only Fleet Managers can access maintenance endpoints.
router.use(authenticateUser, authorizeRoles("Fleet Manager"));

// Start maintenance for a vehicle.
router.post("/:vehicle_id/maintenance", async function (req, res) {
  const vehicleId = Number(req.params.vehicle_id);

  const {
    maintenance_type,
    description,
    maintenance_date,
    odometer_reading,
    cost = 0,
  } = req.body || {};
  const isNonBlankString = (value) =>
    typeof value === "string" && value.trim().length > 0;

  const isValidDate = (value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }

    const date = new Date(`${value}T00:00:00.000Z`);

    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  };

  const validOdometer =
    (typeof odometer_reading === "number" ||
      (typeof odometer_reading === "string" &&
        odometer_reading.trim() !== "")) &&
    Number.isSafeInteger(Number(odometer_reading)) &&
    Number(odometer_reading) >= 0;

  const validCost =
    (typeof cost === "number" ||
      (typeof cost === "string" && cost.trim() !== "")) &&
    Number.isFinite(Number(cost)) &&
    Number(cost) >= 0;

  if (
    !Number.isSafeInteger(vehicleId) ||
    vehicleId <= 0 ||
    !isNonBlankString(maintenance_type) ||
    !isNonBlankString(description) ||
    !isValidDate(maintenance_date) ||
    !validOdometer
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Provide a valid vehicle ID, maintenance type, description, date (YYYY-MM-DD), and non-negative integer odometer reading",
    });
  }

  if (!validCost) {
    return res.status(400).json({
      success: false,
      message: "Cost must be a valid non-negative number",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const vehicleResult = await client.query(
      `SELECT vehicle_id, status, current_odometer
             FROM vehicles
             WHERE vehicle_id = $1
             FOR UPDATE`,
      [vehicleId],
    );

    if (vehicleResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Vehicle not found",
      });
    }

    const vehicle = vehicleResult.rows[0];

    if (
      vehicle.status === "maintenance" ||
      vehicle.status === "out of service"
    ) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "This vehicle cannot start maintenance in its current status",
      });
    }

    if (Number(odometer_reading) < vehicle.current_odometer) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message:
          "Maintenance odometer reading cannot be below the vehicle's current odometer",
      });
    }

    const maintenanceResult = await client.query(
      `INSERT INTO maintenance_records (
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
        maintenance_type,
        description,
        maintenance_date,
        Number(odometer_reading),
        Number(cost),
      ],
    );

    await client.query(
      `UPDATE vehicles
             SET status = 'maintenance',
                 assigned_driver_id = NULL,
                 current_odometer = GREATEST(current_odometer, $1),
                 updated_at = CURRENT_TIMESTAMP
             WHERE vehicle_id = $2`,
      [Number(odometer_reading), vehicleId],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Maintenance started successfully",
      maintenance: maintenanceResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to start maintenance:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to start maintenance",
    });
  } finally {
    client.release();
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
    const vehicleId = Number(req.params.vehicle_id);
    const maintenanceId = Number(req.params.maintenance_id);

    const {
      maintenance_type,
      description,
      maintenance_date,
      odometer_reading,
      cost,
      status,
    } = req.body;

    if (
      !Number.isInteger(vehicleId) ||
      vehicleId <= 0 ||
      !Number.isInteger(maintenanceId) ||
      maintenanceId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle ID or maintenance ID",
      });
    }

    const allowedStatuses = ["in progress", "completed"];

    if (
      (maintenance_type !== undefined &&
        (typeof maintenance_type !== "string" || !maintenance_type.trim())) ||
      (description !== undefined &&
        (typeof description !== "string" || !description.trim())) ||
      (maintenance_date !== undefined &&
        (typeof maintenance_date !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(maintenance_date) ||
          Number.isNaN(Date.parse(maintenance_date)))) ||
      (odometer_reading !== undefined &&
        (!Number.isInteger(Number(odometer_reading)) ||
          Number(odometer_reading) < 0)) ||
      (cost !== undefined &&
        (!Number.isFinite(Number(cost)) || Number(cost) < 0)) ||
      (status !== undefined && !allowedStatuses.includes(status))
    ) {
      return res.status(400).json({
        success: false,
        message: "One or more maintenance fields are invalid",
      });
    }

    if (
      maintenance_type === undefined &&
      description === undefined &&
      maintenance_date === undefined &&
      odometer_reading === undefined &&
      cost === undefined &&
      status === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const recordResult = await client.query(
        `SELECT *
             FROM maintenance_records
             WHERE maintenance_id = $1
               AND vehicle_id = $2
             FOR UPDATE`,
        [maintenanceId, vehicleId],
      );

      if (recordResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Maintenance record not found for this vehicle",
        });
      }

      const existing = recordResult.rows[0];

      if (existing.status !== "in progress") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Only maintenance records in progress can be updated",
        });
      }

      const nextStatus = status ?? existing.status;

      const result = await client.query(
        `UPDATE maintenance_records
 SET maintenance_type = COALESCE($1, maintenance_type),
     description = COALESCE($2, description),
     maintenance_date = COALESCE($3, maintenance_date),
     odometer_reading = COALESCE($4, odometer_reading),
     cost = COALESCE($5, cost),
     status = $6::varchar,
     completed_at = CASE
         WHEN $6::varchar = 'completed' THEN CURRENT_TIMESTAMP
         ELSE completed_at
     END
 WHERE maintenance_id = $7
   AND vehicle_id = $8
 RETURNING *`,

        [
          maintenance_type?.trim() ?? null,
          description?.trim() ?? null,
          maintenance_date ?? null,
          odometer_reading === undefined ? null : Number(odometer_reading),
          cost === undefined ? null : Number(cost),
          nextStatus,
          maintenanceId,
          vehicleId,
        ],
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Maintenance record updated successfully",
        maintenance: result.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to update maintenance:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update maintenance record",
      });
    } finally {
      client.release();
    }
  },
);

// Confirm that a vehicle is ready to return to service.
router.patch(
  "/:vehicle_id/maintenance/:maintenance_id/confirm-ready",
  async function (req, res) {
    const vehicleId = Number(req.params.vehicle_id);
    const maintenanceId = Number(req.params.maintenance_id);

    if (
      !Number.isInteger(vehicleId) ||
      vehicleId <= 0 ||
      !Number.isInteger(maintenanceId) ||
      maintenanceId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicle ID or maintenance ID",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Lock the vehicle so its status cannot change
      // during this transaction.
      const vehicleResult = await client.query(
        `SELECT vehicle_id, status
                 FROM vehicles
                 WHERE vehicle_id = $1
                 FOR UPDATE`,
        [vehicleId],
      );

      if (vehicleResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Vehicle not found",
        });
      }

      // Lock the maintenance record and verify it belongs
      // to this vehicle.
      const recordResult = await client.query(
        `SELECT maintenance_id, vehicle_id, status,
                        ready_confirmed_at
                 FROM maintenance_records
                 WHERE maintenance_id = $1
                   AND vehicle_id = $2
                 FOR UPDATE`,
        [maintenanceId, vehicleId],
      );

      if (recordResult.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({
          success: false,
          message: "Maintenance record not found for this vehicle",
        });
      }

      const vehicle = vehicleResult.rows[0];
      const record = recordResult.rows[0];

      if (record.status !== "completed") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Maintenance must be completed before confirming readiness",
        });
      }

      const latestMaintenanceResult = await client.query(
        `SELECT maintenance_id
   FROM maintenance_records
   WHERE vehicle_id = $1
     AND status <> 'cancelled'
   ORDER BY created_at DESC, maintenance_id DESC
   LIMIT 1
   FOR UPDATE`,
        [vehicleId],
      );

      if (
        latestMaintenanceResult.rows.length === 0 ||
        Number(latestMaintenanceResult.rows[0].maintenance_id) !== maintenanceId
      ) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message:
            "Only the latest non-cancelled maintenance record can be used to confirm readiness",
        });
      }

      const activeMaintenanceResult = await client.query(
        `SELECT maintenance_id
   FROM maintenance_records
   WHERE vehicle_id = $1
     AND status = 'in progress'
   FOR UPDATE`,
        [vehicleId],
      );

      if (activeMaintenanceResult.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Vehicle has another maintenance record in progress",
        });
      }

      if (record.ready_confirmed_at !== null) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message:
            "Vehicle readiness has already been confirmed for this record",
        });
      }

      if (vehicle.status !== "maintenance") {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message:
            "Vehicle must be in maintenance status before confirming readiness",
        });
      }

      // Record the Fleet Manager's readiness confirmation.
      const updatedRecord = await client.query(
        `UPDATE maintenance_records
                 SET ready_confirmed_at = CURRENT_TIMESTAMP
                 WHERE maintenance_id = $1
                   AND vehicle_id = $2
                 RETURNING *`,
        [maintenanceId, vehicleId],
      );

      // Only now return the vehicle to service.
      const updatedVehicle = await client.query(
        `UPDATE vehicles
                 SET status = 'available',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE vehicle_id = $1
                 RETURNING vehicle_id, plate_number, status`,
        [vehicleId],
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Vehicle readiness confirmed successfully",
        maintenance: updatedRecord.rows[0],
        vehicle: updatedVehicle.rows[0],
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to confirm vehicle readiness:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to confirm vehicle readiness",
      });
    } finally {
      client.release();
    }
  },
);

module.exports = router;
