function authorizeAdmin(req, res, next) {
  let role = req.user.role;
  console.log("ROLE FROM TOKEN:", role);
  if (!role || role !== "admin") {
    res.json({
      success: false,
      message: "User not allowed",
    });
    return;
  }
  next();
}

module.exports = { authorizeAdmin };
