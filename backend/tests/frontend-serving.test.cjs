"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  configureFrontendServing,
} = require("../src/config/frontend-serving.js");

const {
  configureStagingAccess,
} = require("../src/config/staging-access.js");

const env = {
  NODE_ENV: "production",
  SERVE_FRONTEND: "true",
  STAGING_ACCESS_ENABLED: "true",
  STAGING_ACCESS_PASSWORD: "synthetic-test-password-123456",
  STAGING_ACCESS_SECRET: "synthetic-signing-secret-123456789",
};

async function withServer(callback, protectedMode = false) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "fmr-frontend-")
  );

  fs.writeFileSync(
    path.join(directory, "index.html"),
    "<html><body>Fleet Master Rwanda</body></html>"
  );

  fs.mkdirSync(path.join(directory, "assets"));

  fs.writeFileSync(
    path.join(directory, "assets", "app.js"),
    'console.log("Fleet Master Rwanda");'
  );

  const app = express();

  if (protectedMode) {
    configureStagingAccess(app, env);
  }

  app.post("/login", (req, res) => {
    res.json({ message: "API login" });
  });

  configureFrontendServing(app, env, directory);

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
    fs.rmSync(directory, {
      recursive: true,
      force: true,
    });
  }
}

test("production refuses disabled frontend serving", () => {
  assert.throws(
    () => configureFrontendServing(express(), {
      NODE_ENV: "production",
    }),
    /Production frontend serving must be enabled/
  );
});

test("production rejects missing frontend build", () => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "fmr-missing-")
  );

  try {
    assert.throws(
      () => configureFrontendServing(express(), env, directory),
      /Frontend production build not found/
    );
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("frontend serving remains optional in development", () => {
  assert.doesNotThrow(
    () => configureFrontendServing(express(), {
      NODE_ENV: "development",
    })
  );
});

test("serves known React browser routes", async () => {
  await withServer(async base => {
    for (const route of [
      "/",
      "/login",
      "/create-account",
      "/admin",
      "/fleet-manager",
    ]) {
      const response = await fetch(base + route, {
        headers: { Accept: "text/html" },
      });

      assert.equal(response.status, 200);
      assert.match(await response.text(), /Fleet Master Rwanda/);
    }
  });
});

test("preserves existing login API", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/login", {
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      message: "API login",
    });
  });
});

test("serves compiled frontend assets", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/assets/app.js");

    assert.equal(response.status, 200);
    assert.match(await response.text(), /console.log/);
  });
});

test("unknown API requests return 404", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/unknown-api");

    assert.equal(response.status, 404);
  });
});

test("unknown browser routes return 404", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/unknown-page", {
      headers: { Accept: "text/html" },
    });

    assert.equal(response.status, 404);
  });
});

test("frontend routes reject non-browser requests", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/admin");

    assert.equal(response.status, 404);
  });
});

test("staging protection blocks unauthorized frontend assets", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/assets/app.js");

    assert.equal(response.status, 401);
  }, true);
});

test("staging protection blocks unauthorized browser navigation", async () => {
  await withServer(async base => {
    const response = await fetch(base + "/admin", {
      redirect: "manual",
      headers: { Accept: "text/html" },
    });

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("location"),
      "/staging-access"
    );
  }, true);
});

test("authorized staging session can load frontend and assets", async () => {
  await withServer(async base => {
    const login = await fetch(base + "/staging-access", {
      method: "POST",
      redirect: "manual",
      body: new URLSearchParams({
        password: env.STAGING_ACCESS_PASSWORD,
      }),
    });

    assert.equal(login.status, 303);

    const cookie = login.headers
      .get("set-cookie").split(";")[0];

    const page = await fetch(base + "/admin", {
      headers: {
        Cookie: cookie,
        Accept: "text/html",
      },
    });

    assert.equal(page.status, 200);

    const asset = await fetch(base + "/assets/app.js", {
      headers: { Cookie: cookie },
    });

    assert.equal(asset.status, 200);
  }, true);
});
