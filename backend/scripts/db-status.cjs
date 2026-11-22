const path = require("node:path");
const { loadEnvFile } = require("node:process");
const { Pool } = require("pg");

// Find the project root independently of the terminal directory.
const projectRoot = path.resolve(__dirname, "../..");

loadEnvFile(path.join(projectRoot, ".env"));

// Require an explicitly selected database for inspection.
const databaseName = process.argv[2];

if (!databaseName) {
  console.error("Usage: node scripts/db-status.cjs <database_name>");
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
  try {
    const identity = await pool.query(`
      SELECT current_database() AS database_name,
             current_user AS database_user
    `);

    console.log("Connected database:", identity.rows[0]);

    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log("\nExisting database tables:");
    console.table(tables.rows);

    const migrationTable = tables.rows.some(
      (row) => row.table_name === "schema_migrations",
    );

    console.log(
      "\nMigration tracking:",
      migrationTable
        ? "Tracking table exists"
        : "No migration tracking table found",
    );
  } catch (error) {
    console.error("Database inspection failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
