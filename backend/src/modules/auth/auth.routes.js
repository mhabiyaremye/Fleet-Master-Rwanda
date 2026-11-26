
const express = require("express");

const { login } = require("./auth.service.js");

const router = express.Router();

router.post("/login", async function (req, res) {
  const email = req.body.email;
  const password = req.body.password;

  try {
    const result = await login({
      email,
      password,
      deviceInfo: req.get("user-agent"),
    });

    return res.json(result);
  } catch (error) {
    console.error("Login failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to complete login",
    });
  }
});

module.exports = router;
