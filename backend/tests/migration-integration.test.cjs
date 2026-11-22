const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { loadEnvFile } = require("node:process");
const { Pool } = require("pg");

// Load environment configuration.
const projectRoot = path.resolve(__dirname, "../..");
loadEnvFile(path.join(projectRoot, ".env"));

// Dedicated testing databases.
const BASELINE_DATABASE = "fleet_master_baseline_test";
const RUNNER_DATABASE = "fleet_master_runner_test";

// Shared PostgreSQL configuration.
const databaseConfig = {
  user: process.env.db_user,
  host: process.env.db_host,
  password: process.env.db_password,
  port: Number(process.env.db_port || 5432),
  connectionTimeoutMillis: 5000,
};

// Connection for baseline verification.
const baselinePool = new Pool({
  ...databaseConfig,
  database: BASELINE_DATABASE,
});

// Connection for migration execution tests.
const runnerPool = new Pool({
  ...databaseConfig,
  database: RUNNER_DATABASE,
});

// TEST 1: Verify the official baseline.
test("baseline migration is recorded and application tables exist", async () => {
  const client = await baselinePool.connect();

  try {
    const identity = await client.query(
      "SELECT current_database() AS database_name",
    );

    assert.equal(identity.rows[0].database_name, BASELINE_DATABASE);

    const migrations = await client.query(`
      SELECT filename
      FROM public.schema_migrations
      ORDER BY filename
    `);

    assert.deepEqual(
      migrations.rows.map((row) => row.filename),
      ["0001_baseline_schema.sql"],
    );

    const tables = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> 'schema_migrations'
      ORDER BY tablename
    `);

    assert.deepEqual(
      tables.rows.map((row) => row.tablename),
      [
        "fuel_budget_items",
        "fuel_budget_proposals",
        "maintenance_records",
        "user_sessions",
        "users",
        "vehicles",
      ],
    );
  } finally {
    client.release();
  }
});

test("reapplying migrations does not duplicate history", async () => {
  // Verify the test is connected to the intended database.
  const identity = await runnerPool.query(
    "SELECT current_database() AS database_name",
  );

  assert.equal(identity.rows[0].database_name, RUNNER_DATABASE);

  // Capture migration history before rerunning.
  const before = await runnerPool.query(`
    SELECT filename, checksum
    FROM public.schema_migrations
    ORDER BY filename
  `);

  assert.equal(before.rows.length, 1);
  assert.equal(before.rows[0].filename, "0001_create_probe.sql");

  // Execute the actual migration runner a second time.
  const result = spawnSync(
    process.execPath,
    [
      path.resolve(__dirname, "../scripts/migrate.cjs"),
      "apply",
      RUNNER_DATABASE,
    ],
    {
      encoding: "utf8",
      timeout: 15000,
    },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Applied: 0/);

  // The migration history must remain unchanged.
  const after = await runnerPool.query(`
    SELECT filename, checksum
    FROM public.schema_migrations
    ORDER BY filename
  `);

  assert.deepEqual(after.rows, before.rows);

  // The original table must still exist.
  const table = await runnerPool.query(`
    SELECT to_regclass('public.migration_test_probe') AS probe
  `);

  assert.notEqual(table.rows[0].probe, null);
});

// TEST 2: Verify transactional rollback.
test("failed migration rolls back schema and history", async () => {
  const fixtureDir = path.resolve(__dirname, "fixtures/migrations");

  const fixturePath = path.join(fixtureDir, "0002_rollback_probe.sql");

  // Do not overwrite an existing fixture.
  assert.equal(
    fs.existsSync(fixturePath),
    false,
    "Temporary rollback fixture already exists",
  );

  // Verify that we're querying the correct test database.
  const identity = await runnerPool.query(
    "SELECT current_database() AS database_name",
  );

  assert.equal(identity.rows[0].database_name, RUNNER_DATABASE);

  // Confirm that the first test migration was applied.
  const initialMigration = await runnerPool.query(`
    SELECT EXISTS (
      SELECT 1
      FROM public.schema_migrations
      WHERE filename = '0001_create_probe.sql'
    ) AS applied
  `);

  assert.equal(initialMigration.rows[0].applied, true);

  // Check that the rollback probe does not exist.
  const existing = await runnerPool.query(`
    SELECT
      to_regclass('public.migration_rollback_probe') AS probe,
      EXISTS (
        SELECT 1
        FROM public.schema_migrations
        WHERE filename = '0002_rollback_probe.sql'
      ) AS recorded
  `);

  assert.equal(existing.rows[0].probe, null);
  assert.equal(existing.rows[0].recorded, false);

  // SQL intentionally contains an error.
  const sql = `
    CREATE TABLE public.migration_rollback_probe (
      id INTEGER PRIMARY KEY
    );

    SELECT 1 / 0;
  `;

  try {
    fs.writeFileSync(fixturePath, sql, {
      flag: "wx",
    });

    // Execute the actual migration runner.
    const result = spawnSync(
      process.execPath,
      [
        path.resolve(__dirname, "../scripts/migrate.cjs"),
        "apply",
        RUNNER_DATABASE,
      ],
      {
        encoding: "utf8",
        timeout: 15000,
      },
    );

    // The migration must fail.
    assert.equal(result.error, undefined);
    assert.notEqual(result.status, 0);

    assert.match(result.stderr, /division by zero/i);

    // Verify rollback in the SAME database.
    const verification = await runnerPool.query(`
      SELECT
        to_regclass('public.migration_rollback_probe') AS probe,
        EXISTS (
          SELECT 1
          FROM public.schema_migrations
          WHERE filename = '0002_rollback_probe.sql'
        ) AS recorded
    `);

    assert.equal(verification.rows[0].probe, null);
    assert.equal(verification.rows[0].recorded, false);
  } finally {
    // Remove the temporary SQL test fixture.
    fs.rmSync(fixturePath, { force: true });
  }
});

// Close both database pools after all tests finish.
test.after(async () => {
  await Promise.all([baselinePool.end(), runnerPool.end()]);
});
