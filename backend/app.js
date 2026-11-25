const { randomUUID } = require("node:crypto");
const { loadEnvFile } = require("node:process");
const path = require("node:path");

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// Load environment variables BEFORE importing database modules.
loadEnvFile(path.join(__dirname, "../.env"));

// Database connection.
const pool = require("./database");

// Backend routes.
const vehicleRoutes = require("./vehicle-routes");
const maintenanceRoutes = require("./maintenance-routes");
const fuelPlanningRoutes = require("./fuel-planning-routes");

// Authentication middleware.
const {
  authenticateUser,
  authorizeRoles,
} = require("./auth-middleware.js");

// Initialize Express.
const app = express();

// Global middleware.
app.use(cors());
app.use(express.json());

// Register routes.
app.use("/vehicles", vehicleRoutes);
app.use("/vehicles", maintenanceRoutes);
app.use("/fuel-planning", fuelPlanningRoutes);



app.post("/login", async function (req, res) {
  const email = req.body.email;
  const password = req.body.password;

  if (!email) {
    return res.json({
      success: false,
      message: "Provide Email",
    });
  }

  if (!password) {
    return res.json({
      success: false,
      message: "Provide password",
    });
  }

  try {
    // 1. Find the user
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        message: "User does not exist",
      });
    }

    const user = result.rows[0];

    // 2. Verify the password
    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.json({
        success: false,
        message: "Incorrect password",
      });
    }

    // 3. Check account status
    if (user.status !== "approved") {
      return res.json({
        success: false,
        message:
          user.status === "pending"
            ? "Account not approved"
            : "Account is not authorized",
      });
    }

    // 4. Generate a unique session ID
    const sessionId = randomUUID();

    // 5. Set the maximum session lifetime to 8 hours
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);

    // 6. Register the session in PostgreSQL
    await pool.query(
      `INSERT INTO public.user_sessions (
        id,
        user_id,
        expires_at,
        device_info
      )
      VALUES ($1, $2, $3, $4)`,
      [sessionId, user.id, expiresAt, req.get("user-agent") || null],
    );

    // 7. Create JWT containing the session ID
    const token = jwt.sign(
      {
        userId: user.id,
        sid: sessionId,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "8h",
      },
    );

    // 8. Return login information
    return res.json({
      success: true,
      message: "Log in successful",
      token: token,
      role: user.role,
    });
  } catch (error) {
    console.error("Login failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to complete login",
    });
  }
});

app.post("/register", function (req, res) {
  let firstname = req.body.firstname;
  let lastname = req.body.lastname;
  let employeeId = req.body.employeeId;
  let gender = req.body.gender;
  let email = req.body.email;
  let password = req.body.password;

  if (!firstname) {
    res.json({
      success: false,
      message: "Provide first name",
    });
    return;
  }
  if (!lastname) {
    res.json({
      success: false,
      message: "Provide last name",
    });
    return;
  }
  if (!employeeId) {
    res.json({
      success: false,
      message: "Provide employee Id",
    });
    return;
  }
  if (!email) {
    res.json({
      success: false,
      message: "Provide email",
    });
    return;
  }
  if (!password) {
    res.json({
      success: false,
      message: "Provide password",
    });
    return;
  }
  if (password.length < 12) {
    res.json({
      success: false,
      message: "Password must be at least 12 characters",
    });
    return;
  }
  if (!gender) {
    res.json({
      success: false,
      message: "Select Gender",
    });
    return;
  }
  pool
    .query("select *from users where employee_id = $1", [employeeId])
    .then(function (result) {
      if (result.rows.length > 0) {
        res.json({
          success: false,
          message: "Employee Id already registered",
        });
        return;
      }
      pool
        .query("select *from users where email = $1", [email])
        .then(function (result) {
          if (result.rows.length > 0) {
            res.json({
              success: false,
              message: "Email already registered",
            });
            return;
          }
          bcrypt
            .hash(password, 10)
            .then(function (hashedpassword) {
              pool
                .query(
                  `insert into users (
            firstname,
            lastname,
            employee_id,
            gender,
            email,
            password)
            values($1,$2,$3,$4,$5,$6)`,
                  [
                    firstname,
                    lastname,
                    employeeId,
                    gender,
                    email,
                    hashedpassword,
                  ],
                )
                .then(function () {
                  res.json({
                    success: true,
                    message: "User added",
                  });
                })
                .catch(function (error) {
                  console.log(error);
                });
            })
            .catch(function (error) {
              console.log(error);
            });
        })
        .catch(function (error) {
          console.log(error);
        });
    })
    .catch(function (error) {
      console.log(error);
    });
});
app.post("/setupadmin", async function (req, res) {
  let firstname = req.body.firstname;
  let lastname = req.body.lastname;
  let employeeId = req.body.employeeId;
  let gender = req.body.gender;
  let email = req.body.email;
  let password = req.body.password;
  let setupCode = req.body.setupCode;

  if (!firstname) {
    res.json({
      success: false,
      message: "Provide firstname",
    });
    return;
  }
  if (!lastname) {
    res.json({
      success: false,
      message: "Provide lastname",
    });
    return;
  }
  if (!employeeId) {
    res.json({
      success: false,
      message: "Provide EmployeeID",
    });
    return;
  }
  if (!gender) {
    res.json({
      success: false,
      message: "Select gender",
    });
    return;
  }
  if (!password) {
    res.json({
      success: false,
      message: "Provide password",
    });
    return;
  }
  if (password.length < 12) {
    res.json({
      success: false,
      message: "Password must be at least 12 characters",
    });
    return;
  }
  if (!setupCode) {
    res.json({
      success: false,
      message: "Provide set-up code",
    });
    return;
  }
  if (setupCode !== process.env.initial_admin_setup_code) {
    res.json({
      success: false,
      message: "Incorrect setupcode",
    });
    return;
  }
  let client;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    client = await pool.connect();
    await client.query("BEGIN");

    // Serialize bootstrap attempts so concurrent requests cannot both pass
    // the initial-admin check and create separate administrator accounts.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      "fleet_master_rwanda_admin_setup",
    ]);

    const adminResult = await client.query(
      "SELECT 1 FROM users WHERE role = $1 LIMIT 1",
      ["admin"],
    );
    if (adminResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({
        success: false,
        message: "Admin already exists",
      });
    }

    const emailResult = await client.query(
      "SELECT 1 FROM users WHERE email = $1 LIMIT 1",
      [email],
    );
    if (emailResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({
        success: false,
        message: "Email already registered",
      });
    }

    const employeeResult = await client.query(
      "SELECT 1 FROM users WHERE employee_id = $1 LIMIT 1",
      [employeeId],
    );
    if (employeeResult.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.json({
        success: false,
        message: "EmployeeId already exists",
      });
    }

    await client.query(
      `INSERT INTO users (
        firstname,
        lastname,
        employee_id,
        gender,
        role,
        status,
        email,
        password
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        firstname,
        lastname,
        employeeId,
        gender,
        "admin",
        "approved",
        email,
        hashedPassword,
      ],
    );

    await client.query("COMMIT");
    return res.json({
      success: true,
      message: "Admin added",
    });
  } catch (error) {
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Admin setup rollback failed:", rollbackError);
      }
    }

    console.error("Failed to set up administrator:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to set up administrator",
    });
  } finally {
    if (client) {
      client.release();
    }
  }
});

// admin-get user

app.get(
  "/get-pending-users",
  authenticateUser,
  authorizeAdmin,
  function (req, res) {
    pool
      .query("select *from users where status = $1 ", ["pending"])
      .then(function (result) {
        if (result.rows.length === 0) {
          res.json({
            success: false,
            message: "You have no pending users",
          });
          return;
        }
        let pendingUsers = result.rows.map(function (user) {
          return {
            firstname: user.firstname,
            lastname: user.lastname,
            gender: user.gender,
            employee_id: user.employee_id,
            email: user.email,
            status: user.status,
          };
        });
        res.json({
          success: true,
          users: pendingUsers,
        });
      });
  },
);
/* app.patch("/update-user",function(req,res){
    let employeeId = req.body.employeeId;
    let role = req.body.role;
    let status = req.body.status;
    if(!employeeId){
        res.json({
            success:false,
            message:"Provide employee_id"
        })
        return;
    }
    if(!role){
        res.json({
            success:false,
            message:"Select role"
        })
        return;
    }
    if(!status){
        res.json({
            success:false,
            message:"Status is null"
        })
        return;
    }


    pool.query("select *from users where employee_id= $1",
    [employeeId]
)
.then(function(result){
    if(result.rows.length === 0){
       res.json({
        success:false,
        message:"Employee Id not found"
       })
       return;
    }
    pool.query(`update users set role = $1,status = $2 where employee_id = $3`,
        [role,status,employeeId]
    )
    .then(function(result){
        res.json({
            success:true,
            message:"User priviledges updated"
    })

    })
    .catch(function(error){
        console.log("database error",error);
        res.json({
            success:false,
            message:"Database error"
        })
    })

}).catch(function(error){
    console.log("database error",error)
    res.json({
        success:false,
        message:"database-error"
    })
})
}) */

//the following middleware is for admin's authorization

function authorizeAdmin(req, res, next) {
  let role = req.user.role;
  console.log("ROLE FROM TOKEN:", role);
  if (!role || role !== "admin") {
    res.json({
      success: false,
      message: "User not allowed",
    });
    return;
  }
  next();
}

app.patch("/approval", authenticateUser, authorizeAdmin, function (req, res) {
  let employeeId = req.body.employeeId;
  let role = req.body.role;
  let allowedRoles = ["Driver", "Fleet Manager", "Finance Manager"];

  if (!employeeId) {
    res.json({
      success: false,
      message: "Employee id not found",
    });
    return;
  }
  if (!role) {
    res.json({
      success: false,
      message: "Select a role ",
    });
    return;
  }
  if (!allowedRoles.includes(role)) {
    res.json({
      success: false,
      message: "Select a valid role ",
    });
    return;
  }
  pool
    .query("select *from users where employee_id = $1", [employeeId])
    .then(function (result) {
      if (result.rows.length === 0) {
        res.json({
          success: false,
          message: "User not found",
        });
        return;
      }
      if (result.rows[0].status !== "pending") {
        res.json({
          success: false,
          message: "Status is not pending",
        });
        return;
      }
      pool
        .query(
          `update users set status = $1 ,role = $2 where employee_id = $3`,
          ["approved", role, employeeId],
        )
        .then(function (result) {
          res.json({
            success: true,
            message: "User approved",
          });
        })
        .catch(function (error) {
          console.log("database error", error);
          res.json({
            success: false,
            message: "Database error",
          });
        });
    })
    .catch(function (error) {
      console.log("Database error", error);
      res.json({
        success: false,
        message: "Database error",
      });
    });
});
app.patch("/rejected", authenticateUser, authorizeAdmin, function (req, res) {
  let employeeId = req.body.employeeId;
  if (!employeeId) {
    res.json({
      success: false,
      message: "Provide employeeId",
    });
    return;
  }

  pool
    .query("select *from users where employee_id = $1", [employeeId])
    .then(function (result) {
      if (result.rows.length === 0) {
        res.json({
          success: false,
          message: "User not found ",
        });
        return;
      }
      if (result.rows[0].status !== "pending") {
        res.json({
          success: false,
          message: "User is not pending ",
        });
        return;
      }
      pool
        .query(`update users set status =$1 where employee_id =$2`, [
          "rejected",
          employeeId,
        ])
        .then(function () {
          res.json({
            success: true,
            message: "User rejected",
          });
        })
        .catch(function (error) {
          console.log("Database error", error);
          res.json({
            success: false,
            message: "Database.error",
          });
        });
    })
    .catch(function (error) {
      console.log("Database error", error);
      res.json({
        success: false,
        message: "Database error",
      });
    });
});

app.patch(
  "/deactivated",
  authenticateUser,
  authorizeAdmin,
  async function (req, res) {
    const employeeId = req.body.employeeId;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Provide Employee Id",
      });
    }

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      // Lock the target user while checking and updating their account.
      const userResult = await client.query(
        `SELECT id, status, role
         FROM users
         WHERE employee_id = $1
         FOR UPDATE`,
        [employeeId],
      );

      if (userResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const targetUser = userResult.rows[0];

      // Prevent an administrator from deactivating their own account.
      if (Number(targetUser.id) === Number(req.user.userId)) {
        await client.query("ROLLBACK");

        return res.status(403).json({
          success: false,
          message: "You cannot deactivate your own account",
        });
      }

      // Protect administrator accounts from this operation.
      if (targetUser.role === "admin") {
        await client.query("ROLLBACK");

        return res.status(403).json({
          success: false,
          message: "Administrator accounts cannot be deactivated here",
        });
      }

      if (targetUser.status !== "approved") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "User is not approved",
        });
      }

      // Deactivate the account.
      await client.query(
        `UPDATE users
         SET status = $1
         WHERE id = $2`,
        ["deactivated", targetUser.id],
      );

      // Revoke every session that has not already been revoked.
      await client.query(
        `UPDATE public.user_sessions
         SET revoked_at = NOW(),
             revocation_reason = $1
         WHERE user_id = $2
         AND revoked_at IS NULL`,
        ["account_deactivated", targetUser.id],
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "User deactivated and active sessions revoked",
      });
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Deactivation rollback failed:", rollbackError);
        }
      }

      console.error("Account deactivation failed:", error.message);

      return res.status(500).json({
        success: false,
        message: "Unable to deactivate user",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  },
);

app.patch("/reactivate", authenticateUser, authorizeAdmin, function (req, res) {
  let employeeId = req.body.employeeId;
  console.log(req.body);
  if (!employeeId) {
    res.json({
      success: false,
      message: "Provide employeeId",
    });
    return;
  }
  pool
    .query("select *from users where employee_id = $1 and status = $2", [
      employeeId,
      "deactivated",
    ])
    .then(function (result) {
      if (result.rows.length === 0) {
        res.json({
          success: false,
          message: "User not found",
        });
        return;
      }
      pool
        .query(`update users set status = $1 where employee_id =$2`, [
          "approved",
          employeeId,
        ])
        .then(function () {
          res.json({
            success: true,
            message: "User reactivated",
          });
        })
        .catch(function (error) {
          console.log("Database error", error);
          res.json({
            success: false,
            message: "Database error",
          });
        });
    })
    .catch(function (error) {
      console.log("Database error", error);
      res.json({
        success: false,
        message: "Database error",
      });
    });
});
app.get(
  "/get-all-users",
  authenticateUser,
  authorizeAdmin,
  function (req, res) {
    pool
      .query("select *from users where status =$1 and role != $2  ", [
        "approved",
        "admin",
      ])
      .then(function (result) {
        if (result.rows.length === 0) {
          res.json({
            success: false,
            message: "No users found",
          });
          return;
        }
        res.json({
          success: true,
          users: result.rows.map(function (user) {
            return {
              firstname: user.firstname,
              lastname: user.lastname,
              employee_id: user.employee_id,
              email: user.email,
              gender: user.gender,
              role: user.role,
              status: user.status,
            };
          }),
        });
      })
      .catch(function (error) {
        console.log("Database error", error);
        res.json({
          success: false,
          message: "Database error",
        });
      });
  },
);
app.get(
  "/get-deactivated-users",
  authenticateUser,
  authorizeAdmin,
  function (req, res) {
    pool
      .query("select *from users where status = $1 and role != $2", [
        "deactivated",
        "admin",
      ])
      .then(function (result) {
        res.json({
          success: true,
          users: result.rows.map(function (user) {
            return {
              firstname: user.firstname,
              lastname: user.lastname,
              employee_id: user.employee_id,
              email: user.email,
              gender: user.gender,
              role: user.role,
              status: user.status,
            };
          }),
        });
      })
      .catch(function (error) {
        console.log("Database error", error);
        res.json({
          success: false,
          message: "Database error",
        });
      });
  },
);

module.exports = app;
