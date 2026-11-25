
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// Replace the database dependency only inside this test process.
const databasePath = require.resolve("../src/config/database.js");
const servicePath = require.resolve(
  "../src/modules/assignments/assignment.service.js"
);

const originalDatabase = require.cache[databasePath];

let activeClient;

require.cache[databasePath] = {
  id: databasePath,
  filename: databasePath,
  loaded: true,
  exports: {
    connect: async () => activeClient,
  },
};

const {
  assignVehicle,
  unassignVehicle,
  AssignmentError,
} = require(servicePath);

// Restore the module cache after loading the service.
// The service retains the injected test pool.
if (originalDatabase) {
  require.cache[databasePath] = originalDatabase;
} else {
  delete require.cache[databasePath];
}

delete require.cache[servicePath];

function createClient(steps) {
  const calls = [];
  const releases = [];

  return {
    calls,
    releases,
    async query(sql, params = []) {
      const statement = sql.trim();
      calls.push({ statement, params });

      const step = steps.shift();

      assert.ok(
        step,
        `Unexpected query: ${statement}`
      );

      assert.match(statement, step.match);

      if (step.error) {
        throw step.error;
      }

      return {
        rows: step.rows || [],
        rowCount: step.rowCount ?? (step.rows || []).length,
      };
    },
    release(error) {
      releases.push(error);
    },
  };
}

function step(match, rows = []) {
  return { match, rows };
}

test("rejects invalid IDs before opening a connection", async () => {
  activeClient = null;

  await assert.rejects(
    assignVehicle(0, 12),
    (error) =>
      error instanceof AssignmentError &&
      error.status === 400
  );

  await assert.rejects(
    assignVehicle(1.5, 12),
    (error) => error.status === 400
  );

  await assert.rejects(
    unassignVehicle(-1),
    (error) => error.status === 400
  );

  await assert.rejects(
    unassignVehicle(1, ""),
    (error) => error.status === 400
  );
});

test("assignment commits vehicle and history together", async () => {
  const steps = [
    step(/^BEGIN$/),
    step(/^SELECT pg_advisory_xact_lock/),
    step(/FROM public\.vehicles[\s\S]*FOR UPDATE/, [
      {
        vehicle_id: 5,
        assigned_driver_id: null,
        status: "available",
      },
    ]),
    step(/FROM public\.users[\s\S]*FOR SHARE/, [
      {
        employee_id: "12",
        firstname: "Test",
        lastname: "Driver",
      },
    ]),
    step(/FROM public\.vehicles[\s\S]*LIMIT 1/),
    step(/FROM public\.vehicle_assignment_history/),
    step(/^UPDATE public\.vehicles/, [
      {
        vehicle_id: 5,
        assigned_driver_id: "12",
        status: "in use",
      },
    ]),
    step(/^INSERT INTO public\.vehicle_assignment_history/),
    step(/^COMMIT$/),
  ];

  const client = createClient(steps);
  activeClient = client;

  const vehicle = await assignVehicle(5, "12");

  assert.equal(vehicle.vehicle_id, 5);
  assert.equal(vehicle.assigned_driver_id, "12");
  assert.equal(vehicle.firstname, "Test");
  assert.equal(vehicle.lastname, "Driver");
  assert.equal(steps.length, 0);
  assert.equal(client.releases.length, 1);
  assert.equal(client.releases[0], undefined);
});

test("history insertion failure rolls back assignment", async () => {
  const dbError = new Error("Simulated history failure");

  const steps = [
    step(/^BEGIN$/),
    step(/^SELECT pg_advisory_xact_lock/),
    step(/FROM public\.vehicles[\s\S]*FOR UPDATE/, [
      {
        vehicle_id: 5,
        assigned_driver_id: null,
        status: "available",
      },
    ]),
    step(/FROM public\.users[\s\S]*FOR SHARE/, [
      {
        employee_id: "12",
        firstname: "Test",
        lastname: "Driver",
      },
    ]),
    step(/FROM public\.vehicles[\s\S]*LIMIT 1/),
    step(/FROM public\.vehicle_assignment_history/),
    step(/^UPDATE public\.vehicles/, [
      {
        vehicle_id: 5,
        assigned_driver_id: "12",
        status: "in use",
      },
    ]),
    {
      match: /^INSERT INTO public\.vehicle_assignment_history/,
      error: dbError,
    },
    step(/^ROLLBACK$/),
  ];

  const client = createClient(steps);
  activeClient = client;

  await assert.rejects(
    assignVehicle(5, "12"),
    (error) => error === dbError
  );

  assert.equal(steps.length, 0);
  assert.equal(client.releases.length, 1);
  assert.equal(client.releases[0], undefined);
  assert.ok(
    !client.calls.some(
      (call) => call.statement === "COMMIT"
    )
  );
});

test("unassignment closes history and commits", async () => {
  const steps = [
    step(/^BEGIN$/),
    step(/FROM public\.vehicles[\s\S]*FOR UPDATE/, [
      {
        vehicle_id: 5,
        assigned_driver_id: "12",
        status: "in use",
      },
    ]),
    step(/^UPDATE public\.vehicle_assignment_history/, [
      { assignment_id: "25" },
    ]),
    step(/^UPDATE public\.vehicles/, [
      {
        vehicle_id: 5,
        assigned_driver_id: null,
        status: "available",
      },
    ]),
    step(/^COMMIT$/),
  ];

  const client = createClient(steps);
  activeClient = client;

  const vehicle = await unassignVehicle(
    5,
    "manual"
  );

  assert.equal(vehicle.assigned_driver_id, null);
  assert.equal(vehicle.status, "available");
  assert.equal(steps.length, 0);
  assert.equal(client.releases.length, 1);
});

test("missing active history prevents unassignment", async () => {
  const steps = [
    step(/^BEGIN$/),
    step(/FROM public\.vehicles[\s\S]*FOR UPDATE/, [
      {
        vehicle_id: 5,
        assigned_driver_id: "12",
        status: "in use",
      },
    ]),
    step(/^UPDATE public\.vehicle_assignment_history/),
    step(/^ROLLBACK$/),
  ];

  const client = createClient(steps);
  activeClient = client;

  await assert.rejects(
    unassignVehicle(5),
    (error) =>
      error instanceof AssignmentError &&
      error.status === 409
  );

  assert.equal(steps.length, 0);
  assert.ok(
    !client.calls.some(
      (call) =>
        call.statement.startsWith(
          "UPDATE public.vehicles"
        )
    )
  );
});
