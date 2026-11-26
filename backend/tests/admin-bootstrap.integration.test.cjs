"use strict";

const {
  test,
  before,
  beforeEach,
  after,
} = require("node:test");

const assert = require("node:assert/strict");
const bcrypt = require("bcryptjs");

require("../src/config/environment.js");

const TEST_DATABASE = "fleet_master_admin_test";

if (process.env.RUN_ADMIN_INTEGRATION !== "1") {
  throw new Error("Use the administrator integration runner");
}

const localHosts = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
]);

if (!localHosts.has(process.env.db_host)) {
  throw new Error("Administrator tests require local PostgreSQL");
}

// Prevent alternative configuration from redirecting tests.
delete process.env.DATABASE_URL;

process.env.DB_HOST = process.env.db_host;
process.env.DB_PORT = process.env.db_port || "5432";
process.env.DB_USER = process.env.db_user;
process.env.DB_PASSWORD = process.env.db_password;
process.env.DB_NAME = TEST_DATABASE;
process.env.DB_SSL_MODE = "disable";

const pool = require("../src/config/database.js");

const {
  createInitialAdmin,
} = require(
  "../src/modules/administration/admin-bootstrap.service.js"
);

let databaseVerified = false;

function admin(overrides = {}) {
  return {
    firstname: "Test",
    lastname: "Administrator",
    employeeId: "ADMIN-TEST-001",
    gender: "Male",
    email: "admin@example.test",
    password: "Synthetic-Test-Password-2026!",
    ...overrides,
  };
}

async function cleanTestUsers() {
  assert.equal(databaseVerified, true);

  await pool.query("DELETE FROM users");
}

before(async () => {
  const result = await pool.query(`
    SELECT current_database() AS database
  `);

  assert.equal(
    result.rows[0].database,
    TEST_DATABASE
  );

  const migrations = await pool.query(`
    SELECT COUNT(*)::integer AS count
    FROM schema_migrations
  `);

  assert.ok(migrations.rows[0].count >= 3);

  databaseVerified = true;
});

beforeEach(async () => {
  await cleanTestUsers();
});

after(async () => {
  try {
    if (databaseVerified) {
      await cleanTestUsers();
    }
  } finally {
    await pool.end();
  }
});

test("creates an approved initial administrator", async () => {
  const input = admin();

  const result = await createInitialAdmin(input);

  assert.equal(result.success, true);

  const users = await pool.query(
    "SELECT * FROM users WHERE employee_id = $1",
    [input.employeeId]
  );

  assert.equal(users.rowCount, 1);
  assert.equal(users.rows[0].role, "admin");
  assert.equal(users.rows[0].status, "approved");
  assert.equal(users.rows[0].email, input.email);
});

test("stores a bcrypt hash instead of plaintext", async () => {
  const input = admin();

  await createInitialAdmin(input);

  const result = await pool.query(
    "SELECT password FROM users WHERE employee_id = $1",
    [input.employeeId]
  );

  const storedPassword = result.rows[0].password;

  assert.notEqual(storedPassword, input.password);

  assert.equal(
    await bcrypt.compare(input.password, storedPassword),
    true
  );

  assert.equal(bcrypt.getRounds(storedPassword), 12);
});

test("rejects an invalid email address", async () => {
  await assert.rejects(
    createInitialAdmin(admin({ email: "invalid-email" })),
    /Invalid email address/
  );
});

test("rejects a short password", async () => {
  await assert.rejects(
    createInitialAdmin(admin({ password: "short" })),
    /Password must/
  );
});

test("rejects passwords exceeding bcrypt byte limit", async () => {
  await assert.rejects(
    createInitialAdmin(admin({ password: "a".repeat(73) })),
    /Password must/
  );
});

test("rejects missing required information", async () => {
  await assert.rejects(
    createInitialAdmin(admin({ firstname: "" })),
    /Invalid or missing firstname/
  );
});

test("rejects a second administrator", async () => {
  await createInitialAdmin(admin());

  await assert.rejects(
    createInitialAdmin(admin({
      employeeId: "ADMIN-TEST-002",
      email: "second@example.test",
    })),
    /administrator already exists/
  );

  const result = await pool.query(
    "SELECT COUNT(*)::integer AS count FROM users"
  );

  assert.equal(result.rows[0].count, 1);
});

test("concurrent bootstrap attempts create only one admin",
  async () => {
    const results = await Promise.allSettled([
      createInitialAdmin(admin()),
      createInitialAdmin(admin({
        employeeId: "ADMIN-TEST-002",
        email: "second@example.test",
      })),
    ]);

    assert.equal(
      results.filter(r => r.status === "fulfilled").length,
      1
    );

    assert.equal(
      results.filter(r => r.status === "rejected").length,
      1
    );

    const result = await pool.query(
      "SELECT COUNT(*)::integer AS count FROM users WHERE role = $1",
      ["admin"]
    );

    assert.equal(result.rows[0].count, 1);
  }
);

async function insertExistingUser() {
  await pool.query(
    `INSERT INTO users (
      firstname,
      lastname,
      employee_id,
      gender,
      role,
      status,
      email,
      password
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      "Existing",
      "Driver",
      "DRIVER-TEST-001",
      "Male",
      "Driver",
      "approved",
      "driver@example.test",
      await bcrypt.hash("Synthetic-Driver-Password!", 10),
    ]
  );
}

test("rejects an existing email address", async () => {
  await insertExistingUser();

  await assert.rejects(
    createInitialAdmin(admin({
      email: "driver@example.test",
    })),
    /Email or employee ID already registered/
  );

  const result = await pool.query(
    "SELECT COUNT(*)::integer AS count FROM users"
  );

  assert.equal(result.rows[0].count, 1);
});

test("rejects an existing employee ID", async () => {
  await insertExistingUser();

  await assert.rejects(
    createInitialAdmin(admin({
      employeeId: "DRIVER-TEST-001",
    })),
    /Email or employee ID already registered/
  );

  const result = await pool.query(
    "SELECT COUNT(*)::integer AS count FROM users"
  );

  assert.equal(result.rows[0].count, 1);
});

test("administrator insertion failure rolls back transaction",
  async () => {
    assert.equal(databaseVerified, true);

    await pool.query(`
      ALTER TABLE users
      ADD CONSTRAINT admin_bootstrap_test_failure
      CHECK (role <> 'admin')
    `);

    try {
      await assert.rejects(
        createInitialAdmin(admin()),
        { code: "23514" }
      );

      const result = await pool.query(
        "SELECT COUNT(*)::integer AS count FROM users"
      );

      assert.equal(result.rows[0].count, 0);

    } finally {
      await pool.query(`
        ALTER TABLE users
        DROP CONSTRAINT admin_bootstrap_test_failure
      `);
    }

    const result = await createInitialAdmin(admin());

    assert.equal(result.success, true);
  }
);
