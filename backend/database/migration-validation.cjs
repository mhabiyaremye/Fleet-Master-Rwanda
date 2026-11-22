const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function readMigrations(migrationsDir) {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  const versions = new Set();

  return files.map((filename) => {
    const match = filename.match(/^(\d{4})_.+\.sql$/);

    if (!match) {
      throw new Error(`Invalid migration filename: ${filename}`);
    }

    if (versions.has(match[1])) {
      throw new Error(`Duplicate migration version: ${match[1]}`);
    }

    versions.add(match[1]);

    const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");

    if (!sql.trim()) {
      throw new Error(`Empty migration file: ${filename}`);
    }
    // Migration transactions are controlled by migrate.cjs.
    // Reject obvious transaction-control statements.
    if (/^\s*(BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION|END)\s*;/im.test(sql)) {
      throw new Error(`Transaction-control statement detected: ${filename}`);
    }

    const checksum = crypto.createHash("sha256").update(sql).digest("hex");

    return { filename, sql, checksum };
  });
}

function validateHistory(migrations, appliedRows) {
  const applied = new Map(
    appliedRows.map((row) => [row.filename, row.checksum.trim()]),
  );

  const fileNames = new Set(migrations.map((migration) => migration.filename));

  for (const filename of applied.keys()) {
    if (!fileNames.has(filename)) {
      throw new Error(`Applied migration missing from disk: ${filename}`);
    }
  }

  let encounteredPending = false;

  for (const migration of migrations) {
    const previousChecksum = applied.get(migration.filename);

    if (previousChecksum === undefined) {
      encounteredPending = true;
      continue;
    }

    if (previousChecksum !== migration.checksum) {
      throw new Error(`Checksum mismatch: ${migration.filename}`);
    }

    if (encounteredPending) {
      throw new Error(`Out-of-order migration history: ${migration.filename}`);
    }
  }

  return applied;
}

module.exports = {
  readMigrations,
  validateHistory,
};
