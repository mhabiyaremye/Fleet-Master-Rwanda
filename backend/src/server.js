"use strict";

const app = require("./app.js");

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST || "0.0.0.0";

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("Invalid server port");
}

if (require.main === module) {
  app.listen(PORT, HOST, function () {
    console.log(`Server listening on ${HOST}:${PORT}`);
  });
}

module.exports = app;
