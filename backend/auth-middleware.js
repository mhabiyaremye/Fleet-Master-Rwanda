const jwt = require("jsonwebtoken");
const pool = require("./database.js");

async function authenticateUser(req, res, next) {
    const authHeaders = req.headers.authorization;

    if (!authHeaders) {
        return res.status(401).json({
            success: false,
            message: "Authentication token required"
        });
    }

    const parts = authHeaders.split(" ");
    const token = parts[1];

    if (parts.length !== 2 || parts[0] !== "Bearer" || !token) {
        return res.status(401).json({
            success: false,
            message: "Authentication token is not valid "
        });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }

    try {
        // Check the account's current state and role so deactivated users or
        // users whose role changed cannot keep using stale JWT claims.
        const result = await pool.query(
            "SELECT role, status FROM users WHERE id = $1",
            [decoded.userId]
        );
        const user = result.rows[0];

        if (!user || user.status !== "approved") {
            return res.status(401).json({
                success: false,
                message: "Account is not authorized"
            });
        }

        req.user = { ...decoded, role: user.role };
        return next();
    } catch (error) {
        console.error("Failed to verify authenticated account:", error);
        return res.status(500).json({
            success: false,
            message: "Unable to authenticate request"
        });
    }
}

function authorizeRoles(...allowedRoles) {
    return function (req, res, next) {
        const role = req.user && req.user.role;

        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: "You are not authorized to access this resource"
            });
        }

        next();
    };
}

module.exports = {
    authenticateUser,
    authorizeRoles
};