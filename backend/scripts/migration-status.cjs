const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { loadEnvFile } = require("node:process");
const { Pool } = require("pg");

const projectRoot = path.resolve(__dirname, "../..");
loadEnvFile(path.join(projectRoot, ".env"));

const databaseName = process.argv[2];
const migrationsDir = path.resolve(__dirname, "../database/migrations");

if (!databaseName) {
  console.error("Usage: node scripts/migration-status.cjs <database_name>");
  process.exit(1);
}

async function main() {
  const pool = new Pool({
    user: process.env.db_user,
    host: process.env.db_host,
    database: databaseName,
    password: process.env.db_password,
    port: Number(process.env.db_port || 5432),
    connectionTimeoutMillis: 5000,
  });

  try {
    const identity = await pool.query(
      "SELECT current_database() AS database_name",
    );

    console.log("Database:", identity.rows[0].database_name);

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    const migrationTable = await pool.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'schema_migrations'
      ) AS exists
    `);

    if (!migrationTable.rows[0].exists) {
      console.log("Migration history: not initialized");

      console.table(
        files.map((file) => ({
          migration: file,
          status: "untracked",
        })),
      );

      return;
    }

    const applied = await pool.query(`
      SELECT filename, checksum, applied_at
      FROM public.schema_migrations
      ORDER BY filename
    `);

    const appliedMap = new Map(applied.rows.map((row) => [row.filename, row]));

    const results = files.map((file) => {
      const content = fs.readFileSync(path.join(migrationsDir, file));

      const checksum = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");

      const previous = appliedMap.get(file);

      return {
        migration: file,
        status: !previous
          ? "pending"
          : previous.checksum === checksum
            ? "applied"
            : "CHECKSUM MISMATCH",
      };
    });

    console.table(results);

    const missingFiles = applied.rows.filter(
      (row) => !files.includes(row.filename),
    );

    if (missingFiles.length) {
      console.error(
        "Applied migrations missing from disk:",
        missingFiles.map((row) => row.filename),
      );
      process.exitCode = 1;
    }

    if (results.some((row) => row.status === "CHECKSUM MISMATCH")) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error("Migration status failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
