const express = require("express");
const bcrypt = require("bcryptjs");

const pool = require("../../config/database.js");

const router = express.Router();

router.post("/setupadmin", async function (req, res) {
  let firstname = req.body.firstname;
  let lastname = req.body.lastname;
  let employeeId = req.body.employeeId;
  let gender = req.body.gender;
  let email = req.body.email;
  let password = req.body.password;
  let setupCode = req.body.setupCode;

  if (!firstname) {
    res.json({
      success: false,
      message: "Provide firstname",
    });
    return;
  }
  if (!lastname) {
    res.json({
      success: false,
      message: "Provide lastname",
    });
    return;
  }
  if (!employeeId) {
    res.json({
      success: false,
      message: "Provide EmployeeID",
    });
    return;
  }
  if (!gender) {
    res.json({
      success: false,
      message: "Select gender",
    });
    return;
  }
  if (!password) {
    res.json({
      success: false,
      message: "Provide password",
    });
    return;
  }
  if (password.length < 12) {
    res.json({
      success: false,
      message: "Password must be at least 12 characters",
    });
    return;
  }
  if (!setupCode) {
    res.json({
      success: false,
      message: "Provide set-up code",
    });
    return;
  }
  if (setupCode !== process.env.initial_admin_setup_code) {
    res.json({
      success: false,
      message: "Incorrect setupcode",
    });
    return;
  }
  let client;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    client = await pool.connect();
    await client.query("BEGIN");

    // Serialize bootstrap attempts so concurrent requests cannot both pass
    // the initial-admin check and create separate administrator accounts.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "fleet_master_rwanda_admin_setup",
    ]);

    const adminResult = await client.query(
      "SELECT 1 FROM users WHERE role = $1 LIMIT 1",
      ["admin"],
    );
    if (adminResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({
        success: false,
        message: "Admin already exists",
      });
    }

    const emailResult = await client.query(
      "SELECT 1 FROM users WHERE email = $1 LIMIT 1",
      [email],
    );
    if (emailResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({
        success: false,
        message: "Email already registered",
      });
    }

    const employeeResult = await client.query(
      "SELECT 1 FROM users WHERE employee_id = $1 LIMIT 1",
      [employeeId],
    );
    if (employeeResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({
        success: false,
        message: "EmployeeId already exists",
      });
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
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        firstname,
        lastname,
        employeeId,
        gender,
        "admin",
        "approved",
        email,
        hashedPassword,
      ],
    );

    await client.query("COMMIT");
    return res.json({
      success: true,
      message: "Admin added",
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Admin setup rollback failed:", rollbackError);
      }
    }

    console.error("Failed to set up administrator:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to set up administrator",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// admin-get user

module.exports = router;
