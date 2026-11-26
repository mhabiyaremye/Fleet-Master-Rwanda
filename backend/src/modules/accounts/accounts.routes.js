const express = require("express");
const bcrypt = require("bcryptjs");

const pool = require("../../config/database.js");

const { authenticateUser } = require("../../middleware/authentication.js");
const { authorizeAdmin } = require("../../middleware/authorization.js");

const router = express.Router();

router.post("/register", function (req, res) {
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

router.get(
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

router.patch("/approval", authenticateUser, authorizeAdmin, function (req, res) {
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
router.patch("/rejected", authenticateUser, authorizeAdmin, function (req, res) {
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

router.patch(
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

router.patch("/reactivate", authenticateUser, authorizeAdmin, function (req, res) {
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
router.get(
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
router.get(
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

module.exports = router;
