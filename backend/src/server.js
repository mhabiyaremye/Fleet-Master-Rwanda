"use strict";

const app = require("./app.js");

if (require.main === module) {
  app.listen(3000, function () {
    console.log("Server initiated");
  });
}

module.exports = app;
