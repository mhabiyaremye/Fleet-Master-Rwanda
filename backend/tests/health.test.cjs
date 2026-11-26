"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

const pool = require("../src/config/database.js");
const healthRoutes = require(
  "../src/modules/health/health.routes.js"
);

async function withServer(callback) {
  const app = express();

  app.use(healthRoutes);

  const server = await new Promise((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => {
      resolve(instance);
    });

    instance.once("error", reject);
  });

  try {
    const address = server.address();

    await callback(
      `http://127.0.0.1:${address.port}`
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

test("health returns HTTP 200", async () => {
  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
    });

    assert.equal(
      response.headers.get("cache-control"),
      "no-store"
    );
  });
});

test("health does not depend on PostgreSQL", async t => {
  const query = t.mock.method(pool, "query", async () => {
    throw new Error("Simulated database failure");
  });

  await withServer(async baseUrl => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.equal(query.mock.callCount(), 0);
  });
});

test("readiness returns HTTP 200 when database is available",
  async t => {
    const query = t.mock.method(pool, "query", async () => ({
      rows: [{ "?column?": 1 }],
    }));

    await withServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/ready`);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        status: "ready",
      });

      assert.equal(query.mock.callCount(), 1);
    });
  }
);

test("readiness returns HTTP 503 when database is unavailable",
  async t => {
    t.mock.method(pool, "query", async () => {
      throw new Error("Sensitive database error");
    });

    await withServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/ready`);

      assert.equal(response.status, 503);
      assert.deepEqual(await response.json(), {
        status: "unavailable",
      });

      assert.equal(
        response.headers.get("cache-control"),
        "no-store"
      );
    });
  }
);
