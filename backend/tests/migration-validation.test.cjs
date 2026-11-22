const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  readMigrations,
  validateHistory,
} = require("../database/migration-validation.cjs");

// Each test uses its own temporary migration directory.
function createTestDirectory(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "fleet-master-migrations-"),
  );

  t.after(() => {
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  });

  return directory;
}

function writeMigration(directory, filename, sql) {
  fs.writeFileSync(path.join(directory, filename), sql, "utf8");
}

test("reads valid migration files", (t) => {
  const directory = createTestDirectory(t);

  writeMigration(directory, "0001_baseline.sql", "SELECT 1;");

  const migrations = readMigrations(directory);

  assert.equal(migrations.length, 1);
  assert.equal(migrations[0].filename, "0001_baseline.sql");
  assert.equal(migrations[0].checksum.length, 64);
});

test("accepts valid applied migration history", (t) => {
  const directory = createTestDirectory(t);

  writeMigration(directory, "0001_first.sql", "SELECT 1;");

  const migrations = readMigrations(directory);

  const applied = validateHistory(migrations, [
    {
      filename: "0001_first.sql",
      checksum: migrations[0].checksum,
    },
  ]);

  assert.equal(applied.size, 1);
});

test("rejects modified migration checksums", (t) => {
  const directory = createTestDirectory(t);

  writeMigration(directory, "0001_first.sql", "SELECT 2;");

  const migrations = readMigrations(directory);

  assert.throws(
    () =>
      validateHistory(migrations, [
        {
          filename: "0001_first.sql",
          checksum: "a".repeat(64),
        },
      ]),
    /Checksum mismatch/,
  );
});

test("rejects missing applied migration files", (t) => {
  const directory = createTestDirectory(t);

  writeMigration(directory, "0002_second.sql", "SELECT 2;");

  const migrations = readMigrations(directory);

  assert.throws(
    () =>
      validateHistory(migrations, [
        {
          filename: "0001_first.sql",
          checksum: "a".repeat(64),
        },
      ]),
    /Applied migration missing from disk/,
  );
});

test("rejects duplicate migration versions", (t) => {
  const directory = createTestDirectory(t);

  writeMigration(directory, "0001_first.sql", "SELECT 1;");
  writeMigration(directory, "0001_other.sql", "SELECT 2;");

  assert.throws(() => readMigrations(directory), /Duplicate migration version/);
});

test("rejects out-of-order applied migrations", (t) => {
  const directory = createTestDirectory(t);

  writeMigration(directory, "0001_first.sql", "SELECT 1;");
  writeMigration(directory, "0002_second.sql", "SELECT 2;");

  const migrations = readMigrations(directory);

  assert.throws(
    () =>
      validateHistory(migrations, [
        {
          filename: "0002_second.sql",
          checksum: migrations[1].checksum,
        },
      ]),
    /Out-of-order migration history/,
  );
});

test("rejects empty migration files", (t) => {
  const directory = createTestDirectory(t);

  writeMigration(directory, "0001_empty.sql", "   ");

  assert.throws(() => readMigrations(directory), /Empty migration file/);
});

test("accepts pending migrations after applied ones", (t) => {
  const directory = createTestDirectory(t);

  writeMigration(directory, "0001_first.sql", "SELECT 1;");
  writeMigration(directory, "0002_second.sql", "SELECT 2;");

  const migrations = readMigrations(directory);

  const applied = validateHistory(migrations, [
    {
      filename: "0001_first.sql",
      checksum: migrations[0].checksum,
    },
  ]);

  assert.equal(applied.has("0001_first.sql"), true);
  assert.equal(applied.has("0002_second.sql"), false);
});

test("rejects transaction-control SQL", (t) => {
  const directory = createTestDirectory(t);

  writeMigration(
    directory,
    "0001_unsafe.sql",
    `
      CREATE TABLE example (id INTEGER);
      COMMIT;
    `,
  );

  assert.throws(
    () => readMigrations(directory),
    /Transaction-control statement detected/,
  );
});
