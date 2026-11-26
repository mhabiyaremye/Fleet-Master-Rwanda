"use strict";

const express = require("express");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "__Host-fmr_staging";
const SESSION_SECONDS = 8 * 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function equalSecrets(first, second) {
  const digest = value =>
    crypto.createHash("sha256")
      .update(value)
      .digest();

  return crypto.timingSafeEqual(
    digest(first),
    digest(second)
  );
}

function configureStagingAccess(app, env = process.env) {
  const enabled = env.STAGING_ACCESS_ENABLED;

  if (env.NODE_ENV === "production" && enabled !== "true") {
    throw new Error("Staging access must be enabled");
  }

  if (enabled !== "true") return;

  const password = env.STAGING_ACCESS_PASSWORD;
  const secret = env.STAGING_ACCESS_SECRET;

  if (
    !password || password.length < 24 ||
    !secret || secret.length < 32 ||
    password === secret ||
    secret === env.JWT_SECRET
  ) {
    throw new Error("Invalid staging access secrets");
  }

  let attempts = 0;
  let windowStart = Date.now();

  function authorized(req) {
    const cookie = (req.headers.cookie || "")
      .split(";")
      .map(value => value.trim())
      .find(value => value.startsWith(COOKIE_NAME + "="));

    if (!cookie) return false;

    try {
      const token = cookie.slice(COOKIE_NAME.length + 1);

      const payload = jwt.verify(token, secret, {
        algorithms: ["HS256"],
        issuer: "fleet-master-staging",
        audience: "staging-access",
        maxAge: SESSION_SECONDS,
      });

      return payload.sub === "staging-visitor";
    } catch {
      return false;
    }
  }

  app.get("/staging-access", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Security-Policy",
      "default-src 'none'; form-action 'self'; frame-ancestors 'none'");

    res.type("html").send(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width">
          <title>Fleet Master Rwanda - Staging</title>
        </head>
        <body>
          <h1>Fleet Master Rwanda</h1>
          <p>Restricted demonstration environment</p>
          <form method="POST" action="/staging-access">
            <label>Access password
              <input type="password" name="password"
                required autocomplete="current-password">
            </label>
            <button type="submit">Continue</button>
          </form>
        </body>
      </html>
    `);
  });

  app.post(
    "/staging-access",
    express.urlencoded({ extended: false, limit: "2kb" }),
    (req, res) => {
      res.setHeader("Cache-Control", "no-store");

      if (Date.now() - windowStart >= WINDOW_MS) {
        attempts = 0;
        windowStart = Date.now();
      }

      if (attempts >= MAX_ATTEMPTS) {
        return res.status(429).send("Try again later");
      }

      if (
        typeof req.body?.password !== "string" ||
        !equalSecrets(req.body.password, password)
      ) {
        attempts++;
        return res.status(401).send("Access denied");
      }

      const token = jwt.sign({}, secret, {
        algorithm: "HS256",
        subject: "staging-visitor",
        issuer: "fleet-master-staging",
        audience: "staging-access",
        expiresIn: SESSION_SECONDS,
      });

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: SESSION_SECONDS * 1000,
      });

      return res.redirect(303, "/");
    }
  );

  app.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");

    if (authorized(req)) return next();

    if (req.method === "GET" &&
        req.headers.accept?.includes("text/html")) {
      return res.redirect(303, "/staging-access");
    }

    return res.status(401).json({
      message: "Staging access required",
    });
  });
}

module.exports = { configureStagingAccess };
