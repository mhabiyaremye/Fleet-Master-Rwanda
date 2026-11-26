

const express = require("express");
const { configureHttpSecurity } = require("./config/http-security.js");

// Load environment variables before importing application modules.
require("./config/environment.js");

// Business modules.
const authRoutes = require("./modules/auth/auth.routes.js");
const accountsRoutes = require("./modules/accounts/accounts.routes.js");
const vehicleRoutes = require("./modules/vehicles/vehicles.routes.js");
const maintenanceRoutes = require("./modules/maintenance/maintenance.routes.js");
const fuelPlanningRoutes = require("./modules/fuel-planning/fuel-planning.routes.js");

// Initialize Express application.
const app = express();

// Global middleware.
configureHttpSecurity(app);
app.use(express.json());

app.use(require("./modules/health/health.routes.js"));

// Authentication and account management.
app.use("/", authRoutes);
app.use("/", accountsRoutes);

// Fleet operations.
app.use("/vehicles", vehicleRoutes);
app.use("/vehicles", maintenanceRoutes);
app.use("/fuel-planning", fuelPlanningRoutes);

module.exports = app;
