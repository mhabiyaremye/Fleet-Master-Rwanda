"use strict";

const readline = require("node:readline/promises");
const { Writable } = require("node:stream");

const pool = require("./src/config/database.js");

const {
  createInitialAdmin,
} = require(
  "./src/modules/administration/admin-bootstrap.service.js"
);

let muted = false;

const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) {
      process.stdout.write(chunk);
    }

    callback();
  },
});

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Interactive terminal required");
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output,
    terminal: true,
  });

  rl.on("SIGINT", () => {
    muted = false;
    process.stdout.write("\nBootstrap cancelled.\n");
    process.exit(130);
  });

  async function askPassword(prompt) {
    process.stdout.write(prompt);
    muted = true;

    try {
      return await rl.question("");
    } finally {
      muted = false;
      process.stdout.write("\n");
    }
  }

  try {
    const result = await pool.query(`
      SELECT
        current_database() AS database,
        current_user AS database_user,
        inet_server_addr()::text AS server_address,
        inet_server_port() AS server_port
    `);

    const target = result.rows[0];

    console.log("\nFleet Master Rwanda");
    console.log("Administrator initialization");
    console.log("----------------------------");
    console.log("Database:", target.database);
    console.log("Database user:", target.database_user);
    console.log("Server:", target.server_address);
    console.log("Port:", target.server_port);

    const confirmation = await rl.question(
      "\nType the database name to continue: "
    );

    if (confirmation !== target.database) {
      console.log("Database confirmation failed.");
      return;
    }

    const existingAdmin = await pool.query(
      "SELECT 1 FROM users WHERE role = $1 LIMIT 1",
      ["admin"]
    );

    if (existingAdmin.rows.length > 0) {
      console.log("An administrator already exists.");
      return;
    }

    const firstname = await rl.question("First name: ");
    const lastname = await rl.question("Last name: ");
    const employeeId = await rl.question("Employee ID: ");
    const gender = await rl.question("Gender: ");
    const email = await rl.question("Email: ");

    const password = await askPassword("Password: ");
    const repeated = await askPassword("Confirm password: ");

    if (password !== repeated) {
      throw new Error("Passwords do not match");
    }

    const confirmed = await rl.question(
      "Type CREATE to initialize administrator: "
    );

    if (confirmed !== "CREATE") {
      console.log("Bootstrap cancelled.");
      return;
    }

    await createInitialAdmin({
      firstname,
      lastname,
      employeeId,
      gender,
      email,
      password,
    });

    console.log("Administrator created successfully.");

  } finally {
    rl.close();
  }
}

main()
  .catch(() => {
    console.error("Administrator initialization failed.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
