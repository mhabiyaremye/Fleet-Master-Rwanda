"use strict";

const bcrypt = require("bcryptjs");
const pool = require("../../config/database.js");

async function createInitialAdmin(input) {
  const {
    firstname,
    lastname,
    employeeId,
    gender,
    email,
    password,
  } = input;

  const fields = {
    firstname,
    lastname,
    employeeId,
    gender,
    email,
    password,
  };

  for (const [name, value] of Object.entries(fields)) {
    if (typeof value !== "string" || !value.trim()) {
      throw new Error(`Invalid or missing ${name}`);
    }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    throw new Error("Invalid email address");
  }

  if (
    password.length < 12 ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new Error(
      "Password must contain at least 12 characters and at most 72 UTF-8 bytes"
    );
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  const client = await pool.connect();

  let discardClient = false;

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext($1))",
      ["fleet_master_rwanda_admin_setup"]
    );

    const existingAdmin = await client.query(
      "SELECT 1 FROM users WHERE role = $1 LIMIT 1",
      ["admin"]
    );

    if (existingAdmin.rows.length > 0) {
      throw new Error("An administrator already exists");
    }

    const duplicate = await client.query(
      `SELECT 1 FROM users
       WHERE LOWER(email) = LOWER($1)
       OR employee_id = $2
       LIMIT 1`,
      [email.trim(), employeeId.trim()]
    );

    if (duplicate.rows.length > 0) {
      throw new Error(
        "Email or employee ID already registered"
      );
    }

    await client.query(
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
        firstname.trim(),
        lastname.trim(),
        employeeId.trim(),
        gender.trim(),
        "admin",
        "approved",
        email.trim(),
        hashedPassword,
      ]
    );

    await client.query("COMMIT");

    return { success: true };

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      discardClient = true;
      console.error("Administrator bootstrap rollback failed");
    }

    throw error;

  } finally {
    client.release(discardClient);
  }
}

module.exports = { createInitialAdmin };
