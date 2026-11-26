"use strict";

const path = require("node:path");
const { Pool } = require("pg");

const {
  STAGING_DATABASE,
  buildMigrationConfig,
} = require("../database/migration-connection.cjs");

const {
  readMigrations,
  validateHistory,
} = require("../database/migration-validation.cjs");

// --------------------------------------------------
// Environment configuration
// --------------------------------------------------

require("../src/config/environment.js");

const command = process.argv[2];
const databaseName = process.argv[3];

// --------------------------------------------------
// Database safety restrictions
// --------------------------------------------------

// Explicitly authorized development/test databases.
// Never include a production database in this list.
const ALLOWED_DATABASES = new Set([
  "fleet_master_restore_test",
  "fleet_master_migration_test",
  "fleet_master_baseline_test",
  "fleet_master_runner_test",
  "fleet_master_assignment_test",
  "fleet_master_admin_test",
  STAGING_DATABASE,
]);

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

const migrationsDir =
  databaseName === "fleet_master_runner_test"
    ? path.resolve(
        __dirname,
        "../tests/fixtures/migrations"
      )
    : path.resolve(
        __dirname,
        "../database/migrations"
      );

// Consistent lock key for all migration runners.
const LOCK_KEY = 781203;

const MIN_POSTGRES_VERSION = 160000;
const TRANSACTION_TIMEOUT_VERSION = 170000;

// --------------------------------------------------
// Command validation
// --------------------------------------------------

if (
  !["init", "apply"].includes(command) ||
  !ALLOWED_DATABASES.has(databaseName)
) {
  console.error(
    "Usage: node scripts/migrate.cjs <init|apply> <allowed_database>"
  );

  process.exit(1);
}

// Integration test databases must be local.
if (
  (
    databaseName === "fleet_master_baseline_test" ||
    databaseName === "fleet_master_runner_test" ||
    databaseName === "fleet_master_assignment_test" ||
    databaseName === "fleet_master_admin_test"
  ) &&
  !LOCAL_HOSTS.has(process.env.db_host)
) {
  console.error(
    "Integration-test migrations require a local PostgreSQL host."
  );

  process.exit(1);
}

// --------------------------------------------------
// PostgreSQL connection
// --------------------------------------------------

const pool = new Pool(
  buildMigrationConfig(databaseName)
);

// --------------------------------------------------
// PostgreSQL version compatibility
// --------------------------------------------------

/**
 * The original baseline contains:
 *
 * SET transaction_timeout = 0;
 *
 * PostgreSQL introduced transaction_timeout in v17.
 *
 * PostgreSQL 16 cannot execute that statement.
 *
 * Preserve the original migration source and checksum.
 * Only adjust the known baseline statement when needed.
 *
 * All other SQL remains unchanged.
 */
function prepareMigrationSql(migration, serverVersion) {
  if (
    !Number.isInteger(serverVersion) ||
    serverVersion < MIN_POSTGRES_VERSION
  ) {
    throw new Error(
      "Unsupported PostgreSQL server version."
    );
  }

  if (
    migration.filename !== "0001_baseline_schema.sql" ||
    serverVersion >= TRANSACTION_TIMEOUT_VERSION
  ) {
    return migration.sql;
  }

  const unsupportedStatement =
    /^SET transaction_timeout = 0;[ \t]*\r?$/gm;

  const matches = migration.sql.match(
    unsupportedStatement
  );

  if (!matches || matches.length !== 1) {
    throw new Error(
      "Baseline compatibility statement was not found exactly once."
    );
  }

  return migration.sql.replace(
    unsupportedStatement,
    "-- PostgreSQL 16 compatibility: transaction_timeout omitted"
  );
}

// --------------------------------------------------
// Main migration runner
// --------------------------------------------------

async function main() {
  let client;
  let transactionStarted = false;
  let discardClient = false;

  try {
    // Read and validate migrations before connecting.
    const availableMigrations =
      command === "apply"
        ? readMigrations(migrationsDir)
        : [];

    // The baseline verification database must remain at migration 0001.
    // Use the original migration object so its checksum is preserved.
    const migrations =
      databaseName === "fleet_master_baseline_test"
        ? availableMigrations.filter(
            (migration) =>
              migration.filename === "0001_baseline_schema.sql"
          )
        : availableMigrations;

    if (
      command === "apply" &&
      databaseName === "fleet_master_baseline_test" &&
      migrations.length !== 1
    ) {
      throw new Error(
        "Baseline verification requires exactly one 0001_baseline_schema.sql migration."
      );
    }

    if (
      command === "apply" &&
      migrations.length === 0
    ) {
      throw new Error(
        "No migration files found."
      );
    }

    client = await pool.connect();

    // Start the migration transaction.
    await client.query("BEGIN");
    transactionStarted = true;

    // ----------------------------------------------
    // Verify database identity
    // ----------------------------------------------

    const identity = await client.query(
      `SELECT current_database() AS database_name`
    );

    const connectedDatabase =
      identity.rows[0]?.database_name;

    if (
      connectedDatabase !== databaseName ||
      !ALLOWED_DATABASES.has(connectedDatabase)
    ) {
      throw new Error(
        "Unexpected database connection."
      );
    }

    // ----------------------------------------------
    // Verify PostgreSQL version
    // ----------------------------------------------

    const versionResult = await client.query(
      "SHOW server_version_num"
    );

    const serverVersion = Number(
      versionResult.rows[0]?.server_version_num
    );

    if (
      !Number.isInteger(serverVersion) ||
      serverVersion < MIN_POSTGRES_VERSION
    ) {
      throw new Error(
        "Unsupported PostgreSQL server version."
      );
    }

    console.log(
      "PostgreSQL server version:",
      serverVersion
    );

    // ----------------------------------------------
    // Prevent concurrent migration runs
    // ----------------------------------------------

    await client.query(
      "SELECT pg_advisory_xact_lock($1)",
      [LOCK_KEY]
    );

    // ----------------------------------------------
    // Initialize migration tracking
    // ----------------------------------------------

    await client.query(`
      CREATE TABLE IF NOT EXISTS
        public.schema_migrations (
          filename TEXT PRIMARY KEY,
          checksum CHAR(64) NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL
            DEFAULT NOW()
        )
    `);

    if (command === "init") {
      await client.query("COMMIT");
      transactionStarted = false;

      console.log(
        "Migration tracking initialized in:",
        databaseName
      );

      return;
    }

    // ----------------------------------------------
    // Validate existing migration history
    // ----------------------------------------------

    const history = await client.query(`
      SELECT filename, checksum
      FROM public.schema_migrations
    `);

    const applied = validateHistory(
      migrations,
      history.rows
    );

    console.log(
      "Migration history validation passed."
    );

    // ----------------------------------------------
    // Execute pending migrations
    // ----------------------------------------------

    let appliedCount = 0;

    for (const migration of migrations) {
      if (applied.has(migration.filename)) {
        console.log(
          "Already applied:",
          migration.filename
        );

        continue;
      }

      console.log(
        "Applying:",
        migration.filename
      );

      // Adapt only the known PostgreSQL compatibility
      // statement when using PostgreSQL 16.
      //
      // The original file and checksum are preserved.
      const executableSql = prepareMigrationSql(
        migration,
        serverVersion
      );

      // Execute the migration in the active transaction.
      await client.query(executableSql);

      // Register the original migration checksum only
      // after successful SQL execution.
      await client.query(
        `INSERT INTO public.schema_migrations (
           filename,
           checksum
         )
         VALUES ($1, $2)`,
        [
          migration.filename,
          migration.checksum,
        ]
      );

      appliedCount++;
    }

    // ----------------------------------------------
    // Commit migrations atomically
    // ----------------------------------------------

    await client.query("COMMIT");
    transactionStarted = false;

    console.log(
      `Migration execution completed. Applied: ${appliedCount}`
    );

  } catch (error) {
    // ----------------------------------------------
    // Roll back failed migrations
    // ----------------------------------------------

    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");

        transactionStarted = false;

        console.error(
          "Migration transaction rolled back."
        );
      } catch (rollbackError) {
        discardClient = true;

        console.error(
          "Migration rollback failed:",
          rollbackError.message
        );
      }
    } else if (client) {
      discardClient = true;
    }

    console.error(
      "Migration execution failed:",
      error.message
    );

    process.exitCode = 1;

  } finally {
    // ----------------------------------------------
    // Release database resources
    // ----------------------------------------------

    if (client) {
      if (discardClient) {
        client.release(
          new Error(
            "Discarding unhealthy migration connection"
          )
        );
      } else {
        client.release();
      }
    }

    await pool.end();
  }
}

// --------------------------------------------------
// Entry point
// --------------------------------------------------

main().catch((error) => {
  console.error(
    "Unexpected migration runner failure:",
    error.message
  );

  process.exitCode = 1;
});
