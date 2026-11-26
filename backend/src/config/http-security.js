"use strict";

require("./environment.js");

const cors = require("cors");

const isProduction = process.env.NODE_ENV === "production";

const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean)
);

if (!isProduction) {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");
}

for (const origin of allowedOrigins) {
  const url = new URL(origin);

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.origin !== origin
  ) {
    throw new Error("Invalid CORS allowed origin");
  }
}

function configureHttpSecurity(app) {
  app.disable("x-powered-by");

  app.use(function (req, res, next) {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");

    next();
  });

  app.use(cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, false);
      }

      return callback(
        null,
        allowedOrigins.has(origin)
      );
    },

    methods: [
      "GET",
      "POST",
      "PATCH",
      "PUT",
      "DELETE",
      "OPTIONS"
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ],

    credentials: false,
    maxAge: 600,
  }));
}

module.exports = {
  configureHttpSecurity,
};
