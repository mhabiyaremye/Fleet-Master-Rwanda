"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const {
  configureHttpSecurity,
} = require("../src/config/http-security.js");

async function withServer(callback) {
  const app = express();

  configureHttpSecurity(app);

  app.get("/probe", (req, res) => {
    res.json({ status: "ok" });
  });

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => {
      resolve(instance);
    });

    instance.once("error", reject);
  });

  try {
    await callback(
      `http://127.0.0.1:${server.address().port}`
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

test("HTTP responses contain security headers", async () => {
  await withServer(async url => {
    const response = await fetch(`${url}/probe`);

    assert.equal(response.status, 200);

    assert.equal(
      response.headers.get("x-powered-by"),
      null
    );

    assert.equal(
      response.headers.get("x-content-type-options"),
      "nosniff"
    );

    assert.equal(
      response.headers.get("x-frame-options"),
      "DENY"
    );

    assert.equal(
      response.headers.get("referrer-policy"),
      "no-referrer"
    );
  });
});

test("requests without Origin receive no CORS approval",
  async () => {
    await withServer(async url => {
      const response = await fetch(`${url}/probe`);

      assert.equal(response.status, 200);

      assert.equal(
        response.headers.get("access-control-allow-origin"),
        null
      );
    });
  }
);

test("unapproved origins receive no CORS approval",
  async () => {
    await withServer(async url => {
      const response = await fetch(`${url}/probe`, {
        headers: {
          Origin: "https://untrusted.example",
        },
      });

      assert.equal(response.status, 200);

      assert.equal(
        response.headers.get("access-control-allow-origin"),
        null
      );
    });
  }
);

test("approved development origin receives CORS approval",
  async () => {
    await withServer(async url => {
      const origin = "http://localhost:5173";

      const response = await fetch(`${url}/probe`, {
        headers: { Origin: origin },
      });

      assert.equal(
        response.headers.get("access-control-allow-origin"),
        origin
      );
    });
  }
);

test("approved origin supports authorization preflight",
  async () => {
    await withServer(async url => {
      const response = await fetch(`${url}/probe`, {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
          "Access-Control-Request-Method": "PATCH",
          "Access-Control-Request-Headers":
            "authorization,content-type",
        },
      });

      assert.equal(response.status, 204);

      assert.equal(
        response.headers.get("access-control-allow-origin"),
        "http://localhost:5173"
      );

      assert.match(
        response.headers.get("access-control-allow-headers"),
        /authorization/i
      );

      assert.match(
        response.headers.get("access-control-allow-methods"),
        /PATCH/
      );
    });
  }
);
