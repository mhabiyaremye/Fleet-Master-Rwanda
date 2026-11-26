"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const jwt = require("jsonwebtoken");

const {
  configureStagingAccess,
} = require("../src/config/staging-access.js");

const env = {
  NODE_ENV: "production",
  STAGING_ACCESS_ENABLED: "true",
  STAGING_ACCESS_PASSWORD: "synthetic-test-password-123456",
  STAGING_ACCESS_SECRET: "synthetic-test-signing-secret-123456789",
  JWT_SECRET: "separate-application-test-secret",
};

async function withServer(callback, config = env) {
  const app = express();

  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  configureStagingAccess(app, config);

  app.get("/", (req, res) => {
    res.send("Protected frontend");
  });

  app.get("/protected", (req, res) => {
    res.json({ authorized: true });
  });

  const server = await new Promise(resolve => {
    const instance = app.listen(0, "127.0.0.1", () => {
      resolve(instance);
    });
  });

  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    await callback(base);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

function login(base, password) {
  return fetch(`${base}/staging-access`, {
    method: "POST",
    redirect: "manual",
    body: new URLSearchParams({ password }),
  });
}

test("production refuses disabled staging protection", () => {
  assert.throws(
    () => configureStagingAccess(express(), {
      ...env,
      STAGING_ACCESS_ENABLED: "false",
    }),
    /Staging access must be enabled/
  );
});

test("rejects missing staging secrets", () => {
  assert.throws(
    () => configureStagingAccess(express(), {
      ...env,
      STAGING_ACCESS_SECRET: "",
    }),
    /Invalid staging access secrets/
  );
});

test("rejects reuse of application JWT secret", () => {
  assert.throws(
    () => configureStagingAccess(express(), {
      ...env,
      JWT_SECRET: env.STAGING_ACCESS_SECRET,
    }),
    /Invalid staging access secrets/
  );
});

test("preserves unprotected local development", async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/protected`);
    assert.equal(response.status, 200);
  }, { NODE_ENV: "development" });
});

test("health endpoint remains accessible", async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/health`);
    assert.equal(response.status, 200);
  });
});

test("rejects unauthorized API requests", async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/protected`);
    assert.equal(response.status, 401);
  });
});

test("redirects unauthorized browser navigation", async () => {
  await withServer(async base => {
    const response = await fetch(base, {
      redirect: "manual",
      headers: { Accept: "text/html" },
    });

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "/staging-access"
    );
  });
});

test("staging access form is available", async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/staging-access`);

    assert.equal(response.status, 200);
    assert.match(await response.text(), /type="password"/);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
});

test("rejects incorrect staging password", async () => {
  await withServer(async base => {
    const response = await login(base, "incorrect");

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("set-cookie"), null);
  });
});

test("valid password issues a secure session cookie", async () => {
  await withServer(async base => {
    const response = await login(
      base,
      env.STAGING_ACCESS_PASSWORD
    );

    assert.equal(response.status, 303);

    const cookie = response.headers.get("set-cookie");

    assert.match(cookie, /__Host-fmr_staging=/);
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /Secure/i);
    assert.match(cookie, /SameSite=Strict/i);
    assert.match(cookie, /Path=\//i);
    assert.match(cookie, /Max-Age=28800/i);
  });
});

test("valid session permits protected requests", async () => {
  await withServer(async base => {
    const response = await login(
      base,
      env.STAGING_ACCESS_PASSWORD
    );

    const cookie = response.headers
      .get("set-cookie").split(";")[0];

    const protectedResponse = await fetch(
      `${base}/protected`,
      { headers: { Cookie: cookie } }
    );

    assert.equal(protectedResponse.status, 200);
  });
});

test("rejects forged session cookies", async () => {
  await withServer(async base => {
    const response = await fetch(`${base}/protected`, {
      headers: {
        Cookie: "__Host-fmr_staging=invalid-token",
      },
    });

    assert.equal(response.status, 401);
  });
});

test("rejects expired staging sessions", async () => {
  await withServer(async base => {
    const token = jwt.sign({}, env.STAGING_ACCESS_SECRET, {
      algorithm: "HS256",
      subject: "staging-visitor",
      issuer: "fleet-master-staging",
      audience: "staging-access",
      expiresIn: -1,
    });

    const response = await fetch(`${base}/protected`, {
      headers: {
        Cookie: `__Host-fmr_staging=${token}`,
      },
    });

    assert.equal(response.status, 401);
  });
});

test("rate limits repeated authentication attempts", async () => {
  await withServer(async base => {
    for (let i = 0; i < 10; i++) {
      const response = await login(base, "incorrect");
      assert.equal(response.status, 401);
    }

    const response = await login(base, "incorrect");
    assert.equal(response.status, 429);
  });
});

test("successful authentication does not consume failure allowance", async () => {
  await withServer(async base => {
    for (let i = 0; i < 12; i++) {
      const response = await login(
        base,
        env.STAGING_ACCESS_PASSWORD
      );

      assert.equal(response.status, 303);
    }
  });
});
