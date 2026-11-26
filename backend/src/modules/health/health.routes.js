"use strict";

const express = require("express");
const pool = require("../../config/database.js");

const router = express.Router();

router.get("/health", function (req, res) {
  res.set("Cache-Control", "no-store");

  return res.status(200).json({
    status: "ok",
  });
});

router.get("/ready", async function (req, res) {
  res.set("Cache-Control", "no-store");

  try {
    await pool.query({
      text: "SELECT 1",
      query_timeout: 3000,
    });

    return res.status(200).json({
      status: "ready",
    });
  } catch {
    return res.status(503).json({
      status: "unavailable",
    });
  }
});

module.exports = router;
