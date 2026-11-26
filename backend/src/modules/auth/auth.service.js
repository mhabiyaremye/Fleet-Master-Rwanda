
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const pool = require("../../config/database.js");

async function login({ email, password, deviceInfo }) {
  if (!email) {
    return {
      success: false,
      message: "Provide Email",
    };
  }

  if (!password) {
    return {
      success: false,
      message: "Provide password",
    };
  }

  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email],
  );

  if (result.rows.length === 0) {
    return {
      success: false,
      message: "User does not exist",
    };
  }

  const user = result.rows[0];

  const passwordMatches = await bcrypt.compare(
    password,
    user.password,
  );

  if (!passwordMatches) {
    return {
      success: false,
      message: "Incorrect password",
    };
  }

  if (user.status !== "approved") {
    return {
      success: false,
      message:
        user.status === "pending"
          ? "Account not approved"
          : "Account is not authorized",
    };
  }

  const sessionId = randomUUID();

  const expiresAt = new Date(
    Date.now() + 8 * 60 * 60 * 1000,
  );

  await pool.query(
    `INSERT INTO public.user_sessions (
      id,
      user_id,
      expires_at,
      device_info
    )
    VALUES ($1, $2, $3, $4)`,
    [sessionId, user.id, expiresAt, deviceInfo || null],
  );

  const token = jwt.sign(
    {
      userId: user.id,
      sid: sessionId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "8h",
    },
  );

  return {
    success: true,
    message: "Log in successful",
    token,
    role: user.role,
  };
}

module.exports = {
  login,
};
