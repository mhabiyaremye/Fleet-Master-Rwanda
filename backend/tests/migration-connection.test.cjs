"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const {
  STAGING_DATABASE,
  buildMigrationConfig,
} = require("../database/migration-connection.cjs");

function stagingEnv(overrides = {}) {
  return {
    MIGRATION_TARGET: "staging",
    STAGING_DB_HOST: "staging.example.test",
    STAGING_DB_NAME: STAGING_DATABASE,
    STAGING_DB_USER: "migration_test_user",
    STAGING_DB_PASSWORD: "synthetic-test-password",
    STAGING_DB_PORT: "5432",
    STAGING_DB_SSL_MODE: "verify-full",
    ...overrides,
  };
}

test("preserves local database configuration", () => {
  const config = buildMigrationConfig(
    "fleet_master_admin_test",
    {
      db_host: "127.0.0.1",
      db_user: "local_test_user",
      db_password: "synthetic-password",
      db_port: "5432",
    }
  );

  assert.equal(config.host, "127.0.0.1");
  assert.equal(config.database, "fleet_master_admin_test");
  assert.equal(config.user, "local_test_user");
  assert.equal(config.port, 5432);
});

test("rejects staging without explicit authorization", () => {
  assert.throws(
    () => buildMigrationConfig(
      STAGING_DATABASE,
      stagingEnv({ MIGRATION_TARGET: "disabled" })
    ),
    /Explicit staging authorization required/
  );
});

test("rejects missing staging configuration", () => {
  assert.throws(
    () => buildMigrationConfig(
      STAGING_DATABASE,
      stagingEnv({ STAGING_DB_PASSWORD: "" })
    ),
    /Missing configuration: STAGING_DB_PASSWORD/
  );
});

test("rejects an unexpected staging database name", () => {
  assert.throws(
    () => buildMigrationConfig(
      STAGING_DATABASE,
      stagingEnv({ STAGING_DB_NAME: "production" })
    ),
    /Unexpected staging database name/
  );
});

test("rejects staging without verified TLS", () => {
  assert.throws(
    () => buildMigrationConfig(
      STAGING_DATABASE,
      stagingEnv({ STAGING_DB_SSL_MODE: "disable" })
    ),
    /Staging migrations require verified TLS/
  );
});

test("rejects invalid staging ports", () => {
  for (const port of ["0", "65536", "invalid", "1.5"]) {
    assert.throws(
      () => buildMigrationConfig(
        STAGING_DATABASE,
        stagingEnv({ STAGING_DB_PORT: port })
      ),
      /Invalid staging database port/
    );
  }
});

test("builds staging configuration with verified TLS", () => {
  const config = buildMigrationConfig(
    STAGING_DATABASE,
    stagingEnv()
  );

  assert.equal(config.database, STAGING_DATABASE);
  assert.equal(config.host, "staging.example.test");
  assert.equal(config.user, "migration_test_user");
  assert.equal(config.ssl.rejectUnauthorized, true);
  assert.equal(config.port, 5432);
});

test("supports a custom trusted certificate authority", () => {
  const config = buildMigrationConfig(
    STAGING_DATABASE,
    stagingEnv({ STAGING_DB_SSL_CA: "synthetic-ca" })
  );

  assert.equal(config.ssl.ca, "synthetic-ca");
  assert.equal(config.ssl.rejectUnauthorized, true);
});

test("ignores application runtime database credentials", () => {
  const config = buildMigrationConfig(
    STAGING_DATABASE,
    stagingEnv({
      DATABASE_URL: "postgres://runtime.example.test",
      DB_USER: "runtime_user",
      DB_NAME: "runtime_database",
    })
  );

  assert.equal(config.user, "migration_test_user");
  assert.equal(config.database, STAGING_DATABASE);
  assert.equal(config.connectionString, undefined);
});
