const path = require("node:path");
const { loadEnvFile } = require("node:process");
const { Pool } = require("pg");

const {
  readMigrations,
  validateHistory,
} = require("../database/migration-validation.cjs");

// Load environment configuration from the project root.
const projectRoot = path.resolve(__dirname, "../..");
loadEnvFile(path.join(projectRoot, ".env"));

const command = process.argv[2];
const databaseName = process.argv[3];

// Safety restriction: only explicitly approved test databases.
const ALLOWED_DATABASES = new Set([
  "fleet_master_restore_test",
  "fleet_master_migration_test",
  "fleet_master_baseline_test",
  "fleet_master_runner_test",
]);

const migrationsDir =
  databaseName === "fleet_master_runner_test"
    ? path.resolve(__dirname, "../tests/fixtures/migrations")
    : path.resolve(__dirname, "../database/migrations");

// All migration runners must use the same lock key.
const LOCK_KEY = 781203;

// Validate command arguments before connecting to PostgreSQL.
if (
  !["init", "apply"].includes(command) ||
  !ALLOWED_DATABASES.has(databaseName)
) {
  console.error(
    "Usage: node scripts/migrate.cjs <init|apply> <allowed_test_database>",
  );
  process.exit(1);
}
if (
  databaseName === "fleet_master_runner_test" &&
  !["localhost", "127.0.0.1", "::1"].includes(process.env.db_host)
) {
  console.error("Integration-test migrations require a local PostgreSQL host.");
  process.exit(1);
}
const pool = new Pool({
  user: process.env.db_user,
  host: process.env.db_host,
  database: databaseName,
  password: process.env.db_password,
  port: Number(process.env.db_port || 5432),
  connectionTimeoutMillis: 5000,
});

async function main() {
  let client;
  let transactionStarted = false;

  try {
    // Read and validate migration files before connecting.
    const migrations = command === "apply" ? readMigrations(migrationsDir) : [];

    if (command === "apply" && migrations.length === 0) {
      throw new Error("No migration files found");
    }

    client = await pool.connect();

    await client.query("BEGIN");
    transactionStarted = true;

    // Verify the database we actually connected to.
    const identity = await client.query(
      "SELECT current_database() AS database_name",
    );

    if (
      identity.rows[0].database_name !== databaseName ||
      !ALLOWED_DATABASES.has(identity.rows[0].database_name)
    ) {
      throw new Error("Unexpected database connection");
    }

    // Prevent concurrent executions of this migration runner.
    await client.query("SELECT pg_advisory_xact_lock($1)", [LOCK_KEY]);

    // Initialize migration tracking when necessary.
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        filename TEXT PRIMARY KEY,
        checksum CHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    if (command === "init") {
      await client.query("COMMIT");
      transactionStarted = false;

      console.log("Migration tracking initialized in:", databaseName);
      return;
    }

    const history = await client.query(`
      SELECT filename, checksum
      FROM public.schema_migrations
    `);

    // Verify the entire migration history before executing SQL.
    const applied = validateHistory(migrations, history.rows);

    console.log("Migration history validation passed.");

    let appliedCount = 0;

    for (const migration of migrations) {
      if (applied.has(migration.filename)) {
        console.log("Already applied:", migration.filename);
        continue;
      }

      console.log("Applying:", migration.filename);

      // Execute the migration inside the active transaction.
      await client.query(migration.sql);

      // Record the migration only after its SQL succeeds.
      await client.query(
        `
        INSERT INTO public.schema_migrations (
          filename,
          checksum
        )
        VALUES ($1, $2)
        `,
        [migration.filename, migration.checksum],
      );

      appliedCount++;
    }

    await client.query("COMMIT");
    transactionStarted = false;

    console.log(`Migration execution completed. Applied: ${appliedCount}`);
  } catch (error) {
    if (client && transactionStarted) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError.message);
      }
    }

    console.error("Migration execution failed:", error.message);

    process.exitCode = 1;
  } finally {
    if (client) {
      client.release();
    }

    await pool.end();
  }
}

main().catch((error) => {
  console.error("Unexpected migration runner failure:", error.message);
  process.exitCode = 1;
});
