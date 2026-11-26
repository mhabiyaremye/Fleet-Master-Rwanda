"use strict";

const express = require("express");
const path = require("node:path");
const fs = require("node:fs");

function configureFrontendServing(
  app,
  env = process.env,
  distDirectory = path.resolve(__dirname, "../../../frontend/dist")
) {
  if (env.SERVE_FRONTEND !== "true") {
    if (env.NODE_ENV === "production") {
      throw new Error("Production frontend serving must be enabled");
    }

    return;
  }

  const indexFile = path.join(
    distDirectory,
    "index.html"
  );

  if (!fs.existsSync(indexFile)) {
    throw new Error("Frontend production build not found");
  }

  app.use(express.static(distDirectory, {
    index: false,
    redirect: false,
    fallthrough: true,
  }));

  const frontendRoutes = [
    "/",
    "/login",
    "/create-account",
    "/admin",
    "/fleet-manager",
  ];

  app.get(frontendRoutes, (req, res, next) => {
    if (!req.headers.accept?.includes("text/html")) {
      return next();
    }

    res.setHeader("Cache-Control", "no-store");

    return res.sendFile(indexFile);
  });
}

module.exports = { configureFrontendServing };
