const express = require("express");
const router = express.Router();
const pool = require("../../config/database.js");

const { authenticateUser, authorizeRoles } = require("../../middleware/authentication.js");

const fuelTypes = ["petrol", "diesel", "electric", "hybrid"];

router.get(
  "/",
  authenticateUser,
  authorizeRoles("Fleet Manager"),
  async function (req, res) {
    try {
      const result = await pool.query(
        `SELECT
           p.*,
           COALESCE(
             json_agg(
               json_build_object(
                 'vehicle_id', i.vehicle_id,
                 'plate_number', v.plate_number,
                 'make', v.make,
                 'model', v.model,
                 'energy_type', i.energy_type,
                 'requested_litres', i.requested_litres,
                 'price_per_litre', i.price_per_litre,
                 'requested_kwh', i.requested_kwh,
                 'price_per_kwh', i.price_per_kwh,
                 'is_included', i.is_included,
                 'estimated_cost', i.estimated_cost
               )
               ORDER BY v.plate_number
             ) FILTER (WHERE i.proposal_id IS NOT NULL),
             '[]'::json
           ) AS items
         FROM fuel_budget_proposals p
         LEFT JOIN fuel_budget_items i
           ON i.proposal_id = p.proposal_id
         LEFT JOIN vehicles v
           ON v.vehicle_id = i.vehicle_id
         WHERE p.created_by = $1
         GROUP BY p.proposal_id
         ORDER BY p.budget_month DESC, p.proposal_id DESC`,
        [req.user.userId],
      );

      return res.status(200).json({
        success: true,
        proposals: result.rows,
      });
    } catch (error) {
      console.error("Failed to retrieve fuel budget drafts:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve fuel budget drafts.",
      });
    }
  },
);

router.post(
  "/",
  authenticateUser,
  authorizeRoles("Fleet Manager"),
  async function (req, res) {
    const { budget_month, justification, items } = req.body;

    const validMonth =
      typeof budget_month === "string" &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(budget_month);

    const validJustification =
      typeof justification === "string" && justification.trim().length > 0;

    const validItems =
      Array.isArray(items) &&
      items.length > 0 &&
      items.every(function (item) {
        return (
          item !== null && typeof item === "object" && !Array.isArray(item)
        );
      });

    const vehicleIds = validItems
      ? items.map(function (item) {
          return Number(item.vehicle_id);
        })
      : [];

    const hasDuplicateVehicles = new Set(vehicleIds).size !== vehicleIds.length;

    if (
      !validMonth ||
      !validJustification ||
      !validItems ||
      hasDuplicateVehicles
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Provide a valid YYYY-MM month, justification, and unique vehicle entries.",
      });
    }

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      const proposalResult = await client.query(
        `INSERT INTO fuel_budget_proposals
          (budget_month, created_by, justification)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [`${budget_month}-01`, req.user.userId, justification.trim()],
      );

      const proposal = proposalResult.rows[0];

      for (const item of items) {
        const {
          vehicle_id,
          energy_type,
          requested_litres = 0,
          price_per_litre = 0,
          requested_kwh = 0,
          price_per_kwh = 0,
          is_included = true,
        } = item;

        const quantitiesAndPrices = [
          requested_litres,
          price_per_litre,
          requested_kwh,
          price_per_kwh,
        ];

        const valuesAreValid = quantitiesAndPrices.every(function (value) {
          return (
            value !== null &&
            value !== "" &&
            Number.isFinite(Number(value)) &&
            Number(value) >= 0
          );
        });

        const validVehicleId =
          Number.isInteger(Number(vehicle_id)) && Number(vehicle_id) > 0;

        let energyValuesAreValid = false;

        if (energy_type === "petrol" || energy_type === "diesel") {
          energyValuesAreValid =
            Number(requested_kwh) === 0 && Number(price_per_kwh) === 0;
        } else if (energy_type === "electric") {
          energyValuesAreValid =
            Number(requested_litres) === 0 && Number(price_per_litre) === 0;
        } else if (energy_type === "hybrid") {
          energyValuesAreValid = true;
        }

        if (
          !validVehicleId ||
          !fuelTypes.includes(energy_type) ||
          !valuesAreValid ||
          !energyValuesAreValid ||
          typeof is_included !== "boolean"
        ) {
          throw new Error("INVALID_FUEL_ITEM");
        }

        const vehicleResult = await client.query(
          `SELECT vehicle_id
           FROM vehicles
           WHERE vehicle_id = $1`,
          [Number(vehicle_id)],
        );

        if (vehicleResult.rows.length === 0) {
          throw new Error("VEHICLE_NOT_FOUND");
        }

        const fuelCost =
          energy_type === "petrol" ||
          energy_type === "diesel" ||
          energy_type === "hybrid"
            ? Number(requested_litres) * Number(price_per_litre)
            : 0;

        const electricityCost =
          energy_type === "electric" || energy_type === "hybrid"
            ? Number(requested_kwh) * Number(price_per_kwh)
            : 0;

        const estimatedCost = is_included ? fuelCost + electricityCost : 0;

        await client.query(
          `INSERT INTO fuel_budget_items (
            proposal_id,
            vehicle_id,
            energy_type,
            requested_litres,
            price_per_litre,
            requested_kwh,
            price_per_kwh,
            is_included,
            estimated_cost
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            proposal.proposal_id,
            Number(vehicle_id),
            energy_type,
            Number(requested_litres),
            Number(price_per_litre),
            Number(requested_kwh),
            Number(price_per_kwh),
            is_included,
            estimatedCost,
          ],
        );
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Fuel budget draft saved successfully.",
        proposal,
      });
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Fuel budget rollback failed:", rollbackError);
        }
      }

      if (
        error.message === "INVALID_FUEL_ITEM" ||
        error.message === "VEHICLE_NOT_FOUND"
      ) {
        return res.status(400).json({
          success: false,
          message:
            error.message === "VEHICLE_NOT_FOUND"
              ? "One of the selected vehicles does not exist."
              : "One or more vehicle entries contain invalid values.",
        });
      }

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "A vehicle can only appear once in the same proposal.",
        });
      }

      console.error("Failed to save fuel budget:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to save fuel budget draft.",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

module.exports = router;
