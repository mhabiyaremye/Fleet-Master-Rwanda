
const { loadEnvFile } = require("node:process");
const path = require("node:path");

const express = require("express");
const cors = require("cors");

// Load environment variables before importing application modules.
loadEnvFile(path.join(__dirname, "../../.env"));

// Business modules.
const authRoutes = require("./modules/auth/auth.routes.js");
const accountsRoutes = require("./modules/accounts/accounts.routes.js");
const administrationRoutes = require("./modules/administration/administration.routes.js");
const vehicleRoutes = require("./modules/vehicles/vehicles.routes.js");
const maintenanceRoutes = require("./modules/maintenance/maintenance.routes.js");
const fuelPlanningRoutes = require("./modules/fuel-planning/fuel-planning.routes.js");

// Initialize Express application.
const app = express();

// Global middleware.
app.use(cors());
app.use(express.json());

// Authentication and account management.
app.use("/", authRoutes);
app.use("/", accountsRoutes);
app.use("/", administrationRoutes);

// Fleet operations.
app.use("/vehicles", vehicleRoutes);
app.use("/vehicles", maintenanceRoutes);
app.use("/fuel-planning", fuelPlanningRoutes);

module.exports = app;
