const jwt = require("jsonwebtoken");
const pool = require("./src/config/database.js");

async function authenticateUser(req, res, next) {
  const authHeaders = req.headers.authorization;

  if (!authHeaders) {
    return res.status(401).json({
      success: false,
      message: "Authentication token required",
    });
  }

  const parts = authHeaders.split(" ");
  const token = parts[1];

  if (parts.length !== 2 || parts[0] !== "Bearer" || !token) {
    return res.status(401).json({
      success: false,
      message: "Authentication token is not valid",
    });
  }

  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Ensure the token contains the required session information.
    if (!decoded.userId || !decoded.sid) {
      return res.status(401).json({
        success: false,
        message: "Invalid session token",
      });
    }
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  try {
    // Check whether this particular login session is still active.
    const sessionResult = await pool.query(
      `SELECT id, user_id
             FROM public.user_sessions
             WHERE id = $1
             AND user_id = $2
             AND revoked_at IS NULL
             AND expires_at > NOW()
             AND last_activity_at > NOW() - INTERVAL '10 minutes'`,
      [decoded.sid, decoded.userId],
    );

    if (sessionResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Session expired or revoked. Please log in again.",
      });
    }

    // Update activity, but avoid writing to the database
    // on every single API request.
    await pool.query(
      `UPDATE public.user_sessions
             SET last_activity_at = NOW()
             WHERE id = $1
             AND last_activity_at < NOW() - INTERVAL '1 minute'`,
      [decoded.sid],
    );

    // Verify the user's current account status and role.
    const result = await pool.query(
      "SELECT role, status FROM users WHERE id = $1",
      [decoded.userId],
    );

    const user = result.rows[0];

    if (!user || user.status !== "approved") {
      return res.status(401).json({
        success: false,
        message: "Account is not authorized",
      });
    }

    req.user = {
      ...decoded,
      role: user.role,
    };

    return next();
  } catch (error) {
    console.error("Authentication verification failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to authenticate request",
    });
  }
}

function authorizeRoles(...allowedRoles) {
  return function (req, res, next) {
    const role = req.user && req.user.role;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to access this resource",
      });
    }

    next();
  };
}

module.exports = {
  authenticateUser,
  authorizeRoles,
};
