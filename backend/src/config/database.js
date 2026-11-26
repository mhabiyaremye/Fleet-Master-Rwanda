"use strict";

require("./environment.js");

const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;

const sslMode = process.env.DB_SSL_MODE || "disable";

if (!["disable", "verify-full"].includes(sslMode)) {
  throw new Error("Unsupported DB_SSL_MODE");
}

const config = databaseUrl
  ? {
      connectionString: databaseUrl,
    }
  : {
      user: process.env.DB_USER ?? process.env.db_user,
      host: process.env.DB_HOST ?? process.env.db_host,
      database: process.env.DB_NAME ?? process.env.db_name,
      password: process.env.DB_PASSWORD ?? process.env.db_password,
      port: Number(
        process.env.DB_PORT ?? process.env.db_port ?? 5432
      ),
    };

if (databaseUrl) {
  const url = new URL(databaseUrl);

  for (const parameter of [
    "sslmode",
    "sslcert",
    "sslkey",
    "sslrootcert",
    "ssl"
  ]) {
    if (url.searchParams.has(parameter)) {
      throw new Error(
        "Configure database TLS through DB_SSL_MODE"
      );
    }
  }
}

const pool = new Pool({
  ...config,

  ssl: sslMode === "verify-full"
    ? {
        rejectUnauthorized: true,
        ...(process.env.DB_SSL_CA
          ? { ca: process.env.DB_SSL_CA }
          : {}),
      }
    : false,

  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on("error", function (error) {
  console.error(
    "Unexpected idle database connection error:",
    error.code || error.name
  );
});

module.exports = pool;
