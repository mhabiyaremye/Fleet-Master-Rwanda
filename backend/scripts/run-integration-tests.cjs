"use strict";

const path = require("node:path");
const { loadEnvFile } = require("node:process");
const { spawnSync } = require("node:child_process");

const backendDirectory = path.resolve(__dirname, "..");

const integrationSuites = {

  administration: {
    file: "tests/admin-bootstrap.integration.test.cjs",
    environment: {
      RUN_ADMIN_INTEGRATION: "1",
    },
  },

  migrations: {
    file: "tests/migration-integration.test.cjs",
    environment: {},
  },

  assignment: {
    file: "tests/vehicle-assignment.integration.test.cjs",
    environment: {
      RUN_ASSIGNMENT_INTEGRATION: "1",
    },
  },

  maintenance: {
    file: "tests/vehicle-maintenance.integration.test.cjs",
    environment: {
      RUN_MAINTENANCE_INTEGRATION: "1",
    },
  },

  "maintenance-api": {
    file: "tests/vehicle-maintenance.api.integration.test.cjs",
    environment: {
      RUN_MAINTENANCE_API_INTEGRATION: "1",
    },
  },
};

function runIntegrationSuite() {
  const suiteName = process.argv[2];

  if (!Object.hasOwn(integrationSuites, suiteName)) {
    console.error(
      "Specify an integration suite:",
      Object.keys(integrationSuites).join(", ")
    );

    process.exitCode = 1;
    return;
  }

  loadEnvFile(
    path.resolve(backendDirectory, "../.env")
  );

  const localDatabaseHosts = new Set([
    "localhost",
    "127.0.0.1",
    "::1",
  ]);

  if (!localDatabaseHosts.has(process.env.db_host)) {
    throw new Error(
      "Integration tests require a local PostgreSQL host."
    );
  }

  const suite = integrationSuites[suiteName];

  console.log(
    `Running integration suite: ${suiteName}`
  );

  const result = spawnSync(
    process.execPath,
    ["--test", suite.file],
    {
      cwd: backendDirectory,
      stdio: "inherit",
      env: {
        ...process.env,
        ...suite.environment,
      },
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    console.error(
      `Integration suite failed: ${suiteName}`
    );

    process.exitCode = result.status ?? 1;
  }
}

try {
  runIntegrationSuite();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
