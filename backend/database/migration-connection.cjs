"use strict";

const STAGING_DATABASE = "fleet_master_staging";

function buildMigrationConfig(databaseName, env = process.env) {
  if (databaseName !== STAGING_DATABASE) {
    return {
      user: env.db_user,
      host: env.db_host,
      database: databaseName,
      password: env.db_password,
      port: Number(env.db_port || 5432),
      connectionTimeoutMillis: 5000,
      max: 2,
    };
  }

  if (env.MIGRATION_TARGET !== "staging") {
    throw new Error("Explicit staging authorization required");
  }

  const required = [
    "STAGING_DB_HOST",
    "STAGING_DB_NAME",
    "STAGING_DB_USER",
    "STAGING_DB_PASSWORD",
    "STAGING_DB_PORT",
  ];

  for (const name of required) {
    if (!env[name]?.trim()) {
      throw new Error(`Missing configuration: ${name}`);
    }
  }

  if (env.STAGING_DB_NAME !== STAGING_DATABASE) {
    throw new Error("Unexpected staging database name");
  }

  if (env.STAGING_DB_SSL_MODE !== "verify-full") {
    throw new Error("Staging migrations require verified TLS");
  }

  const port = Number(env.STAGING_DB_PORT);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Invalid staging database port");
  }

  return {
    host: env.STAGING_DB_HOST,
    database: STAGING_DATABASE,
    user: env.STAGING_DB_USER,
    password: env.STAGING_DB_PASSWORD,
    port,
    ssl: {
      rejectUnauthorized: true,
      ...(env.STAGING_DB_SSL_CA
        ? { ca: env.STAGING_DB_SSL_CA }
        : {}),
    },
    connectionTimeoutMillis: 5000,
    max: 2,
  };
}

module.exports = {
  STAGING_DATABASE,
  buildMigrationConfig,
};
