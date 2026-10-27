const jwt = require("jsonwebtoken");

function authenticateUser(req, res, next) {
    const authHeaders = req.headers.authorization;

    if (!authHeaders) {
        return res.json({
            success: false,
            message: "Authentication token requried"
        });
    }

    const parts = authHeaders.split(" ");
    const token = parts[1];

    if (parts[0] !== "Bearer" || !parts[1]) {
        return res.json({
            success: false,
            message: "Authentication token is not valid "
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
    } catch (error) {
        return res.json({
            success: false,
            message: "Invalid or expired token"
        });
    }

    next();
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