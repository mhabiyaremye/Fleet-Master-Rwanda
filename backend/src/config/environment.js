"use strict";

const path = require("node:path");
const { loadEnvFile } = require("node:process");

const envPath = path.resolve(__dirname, "../../../.env");

try {
  loadEnvFile(envPath);
} catch (error) {
  if (error.code !== "ENOENT") {
    throw error;
  }
}

module.exports = process.env;
