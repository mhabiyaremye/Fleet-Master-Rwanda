const {loadEnvFile}=require("node:process");
const express=require("express");
const cors=require("cors");
const bcrypt=require("bcryptjs")
const app=express();
loadEnvFile("../.env");
const pool = require ("./database");
const vehicleRoutes=require("./vehicle-routes");
const jwt=require("jsonwebtoken");
app.use(cors());
app.use(express.json());
app.use("/vehicles",vehicleRoutes);

app.post("/login",function(req,res){
let email=req.body.email;
let password=req.body.password;
/* The following section checks whether the credentials have been
   passed to the front-end */

if(!email){
    res.json({
        success:false,
        message:"Provide Email"
    })
    return
}
if(!password){
    res.json({
        success:false,
        message:"Provide password "
    })
    return;
}



// After checking that they are values passed to the front-end
// the following code validates the user whether they exist or not
// by validating their email and 
// checking their passwords 

pool.query("select *from users where email = $1",
    [email]
)
.then(function(result){
    if(result.rows.length === 0 ){
        res.json({
            success:false,
            message:"user does not exist"
        })
        return;
    }
    bcrypt.compare(password,result.rows[0].password)
    .then(function(passwordmatches){
        if(!passwordmatches){
            res.json({
                success:false,
                message:"Incorrect password"
            })
             return;
        }
       let blockedUsers = ["rejected","deactivated"]
    if(result.rows[0].status === "pending"){
        res.json({
            success:false,
            message:"Account not approved"
        })
        return;
      }
      if(blockedUsers.includes(result.rows[0].status)){
        res.json({
            success:false,
            message:"Account might have been rejected or blocked"
        })
        return;
      }
     
      if(result.rows[0].status === "approved"){
        let token = jwt.sign(
        {userId:result.rows[0].id,
            role:result.rows[0].role,
        },
        process.env.JWT_SECRET,{
            expiresIn:"1h"
        }
     )
      console.log("LOGIN ROLE:", result.rows[0].role);
    res.json({
        success:true,
        message:"Log in successful",
        token:token,
        role:result.rows[0].role
        
        
    })
    return;
      }
    })
    .catch(function(error){
        console.log(error);
    })
    
})
.catch(function(error){
    console.log(error)
})



})
app.post("/register",function(req,res){
    let firstname=req.body.firstname;
    let lastname=req.body.lastname;
    let employeeId=req.body.employeeId;
    let gender=req.body.gender;
    let email=req.body.email;
    let password=req.body.password;

    if(!firstname){
    res.json({
        success:false,
        message:"Provide first name"
    })
    return;
    } 
    if(!lastname){
    res.json({
        success:false,
        message:"Provide last name"
    })
    return;
    }
    if(!employeeId){
        res.json({
            success:false,
            message:"Provide employee Id"
        })
        return;
    }
    if(!email){
        res.json({
            success:false,
            message:"Provide email"
        })
        return;
    }
    if(!password){
        res.json({
            success:false,
            message:"Provide password"
        })
        return;
    }
    if(password.length < 12){
        res.json({
            success:false,
            message:"Password must be at least 12 characters"
        })
        return;
    }
    if(!gender){
    res.json({
        success:false,
        message:"Select Gender"
    })
    return;
    }
    pool.query("select *from users where employee_id = $1",
        [employeeId]
    )
    .then(function(result){
        if(result.rows.length > 0){
            res.json({
                success:false,
                message:"Employee Id already registered"
            })
            return;
         }
         pool.query("select *from users where email = $1",
            [email]
         )
         .then(function(result){
            if(result.rows.length > 0){
                res.json({
                    success:false,
                    message:"Email already registered"
                })
                return
            }
    bcrypt.hash(password,10)
    .then(function(hashedpassword){
        pool.query(`insert into users (
            firstname,
            lastname,
            employee_id,
            gender,
            email,
            password)
            values($1,$2,$3,$4,$5,$6)`,
        [firstname,lastname,employeeId,gender,email,hashedpassword])
    .then(function(){
        res.json({
            success:true,
            message:"User added"
        })
        })
        .catch(function(error){
            console.log(error);
        })
    })
    .catch(function(error){
        console.log(error);
    })
    }).catch(function(error){
        console.log(error);
    })
    })
    .catch(function(error){
        console.log(error);
    })
})
app.post("/setupadmin",function(req,res){

    let firstname=req.body.firstname;
    let lastname=req.body.lastname;
    let employeeId=req.body.employeeId;
    let gender=req.body.gender;
    let email=req.body.email;
    let password=req.body.password;
    let setupCode=req.body.setupCode;

    if(!firstname){
        res.json({
            success:false,
            message:"Provide firstname"
        })
        return;
    }
    if(!lastname){
        res.json({
            success:false,
            message:"Provide lastname"
        })
        return;
    }
    if(!employeeId){
        res.json({
            success:false,
            message:"Provide EmployeeID"
        })
        return;
    }
    if(!gender){
        res.json({
            success:false,
            message:"Select gender"
    })
    return;
    }
    if(!password){
        res.json({
            success:false,
            message:"Provide password"
        })
        return;
    }
    if(password.length<12){
        res.json({
            success:false,
            message:"Password must be at least 12 characters"
        })
        return;
    }
    if(!setupCode){
        res.json({
        success:false,
        message:"Provide set-up code"
    })
    return;
    }
    if(setupCode !== process.env.initial_admin_setup_code){
        res.json({
            success:false,
            message:"Incorrect setupcode"
        })
        return;
    }
  pool.query("select *from users where role = $1 ",
    ["admin"]
  )
  .then(function(result){
    if(result.rows.length > 0){
        res.json({
            success:false,
            message:"Admin already exists"
        })
        return;
    }
    pool.query("select *from users where email =$1",
        [email]
    )
    .then(function(result){
        if(result.rows.length >0){
            res.json({
            success:false,
            message:"Email already registered"
            })
            return;
        }
        pool.query("select *from users where employee_id = $1",
            [employeeId]
        )
        .then(function(result){
            if(result.rows.length > 0){
                res.json({
                    success:false,
                    message:"EmployeeId already exists"
                })
                return;
            }
            bcrypt.hash(password,10)
            .then(function(hashedpassword){
            pool.query(`insert into users(
                firstname,
                lastname,
                employee_id,
                gender,
                role,
                status,
                email,
                password)values
                ($1,$2,$3,$4,$5,$6,$7,$8)`,
            [firstname,lastname,employeeId,gender,"admin","approved",email,hashedpassword])

        .then(function(){
            res.json({
                success:true,
                message:"Admin added"
            })
        })
        .catch(function(error){
            console.log(error);
        })
        })
        .catch(function(error){
            console.log(error);
        })
        })
        .catch(function(error){
            console.log(error);
        })
    })
    .catch(function(error){
        console.log(error);
    })
})
.catch(function(error){
    console.log(error);
})   
    
})


// admin-get user

app.get("/get-pending-users",authenticateUser,authorizeAdmin,function(req,res){
    
    pool.query("select *from users where status = $1 ",
        ["pending"]
    )
    .then(function(result){
        if(result.rows.length === 0){
            res.json({
                success:false,
                message:"You have no pending users"
            })
            return;
        }
        let pendingUsers = result.rows.map(function(user){
           return{ 
           firstname : user.firstname,
           lastname : user.lastname,
           gender : user.gender,
           employee_id : user.employee_id,
           email : user.email,
           status : user.status
           }
    })
    res.json({
        success:true,
        users:pendingUsers
    })
    })
})
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

// the following middleware's is for token validation 
function authenticateUser(req,res,next){
    let authHeaders=req.headers.authorization;
    if(!authHeaders){
        res.json({
            success:false,
            message:"Authentication token requried"
        })
        return;
    }
    let parts=authHeaders.split(" ");
    let token=parts[1];
    if(parts[0] !=="Bearer" || !parts[1]){
        res.json({
            success:false,
            message:"Authentication token is not valid "
        })
        return;
    }
    try{
        let decoded=jwt.verify(token,process.env.JWT_SECRET);
        req.user=decoded;
    }
    catch(error){
        res.json({
            success:false,
            message:"Invalid or expired token"
        })
        return;
    }
    next();
    
}
//the following middleware is for admin's authorization

function authorizeAdmin(req,res,next){
    let role=req.user.role;
    console.log("ROLE FROM TOKEN:", role);
    if(!role || role !=="admin"){
        res.json({
            success:false,
            message:"User not allowed"
        })
        return;
    }
    next();
}



app.patch("/approval",authenticateUser,authorizeAdmin,function(req,res){
    let employeeId = req.body.employeeId;
    let role = req.body.role;
    let allowedRoles = ["Driver" , "Fleet Manager", "Finance Manager"]
    

    if(!employeeId){
        res.json({
            success:false,
            message:"Employee id not found"
        })
        return;
    }
    if(!role){
        res.json({
            success:false,
            message:"Select a role "
        })
        return;
    }
    if(!allowedRoles.includes(role)){
        res.json({
            success:false,
            message:"Select a valid role "
        })
        return;
    }
    pool.query("select *from users where employee_id = $1",
        [employeeId]
    )
    .then(function(result){

        if(result.rows.length === 0){
            res.json({
                success:false,
                message:"User not found"
            })
            return;
        }
        if (result.rows[0].status !== "pending") {
           res.json({
               success: false,
               message: "Status is not pending"
            });
            return;
        }
        pool.query(`update users set status = $1 ,role = $2 where employee_id = $3`,
            ["approved",role,employeeId]
        )
        .then(function(result){
            res.json({
                success:true,
                message:"User approved"
            })
        })
        .catch(function(error){
            console.log("database error",error);
            res.json({
                success:false,
                message:"Database error"
            })
        })
    })
    .catch(function(error){
        console.log("Database error",error)
        res.json({
            success:false,
            message:"Database error"
        })
    })
})
app.patch("/rejected",authenticateUser,authorizeAdmin,function(req,res){
    let employeeId = req.body.employeeId;
    if(!employeeId){
        res.json({
            success:false,
            message:"Provide employeeId"
        })
        return;
    }

    pool.query("select *from users where employee_id = $1",
        [employeeId]
    ).then(function(result){
        if(result.rows.length === 0){
            res.json({
                success:false,
                message:"User not found "
            })
            return;
        }
        if(result.rows[0].status !== "pending"){
            res.json({
                success:false,
                message:"User is not pending "
            })
            return;
        }
            pool.query(`update users set status =$1 where employee_id =$2`,
                ["rejected",employeeId])
                .then(function(){
                    res.json({
                    success:true,
                    message:"User rejected"
                    })
                })
                .catch(function(error){
                    console.log("Database error",error);
                    res.json({
                        success:false,
                        message:"Database.error"
                    })
                })   
    })
    .catch(function(error){
        console.log("Database error",error);
        res.json({
            success:false,
            message:"Database error"
        })
    })
})
app.patch("/deactivated",authenticateUser,authorizeAdmin,function(req,res){
    let employeeId = req.body.employeeId;
    if(!employeeId){
        res.json({
            success:false,
            message:"Provide Employee Id"
        })
        return;
    }
    pool.query("select *from users where employee_id = $1",
        [employeeId]
    )
    .then(function(result){
        if(result.rows.length === 0){
            res.json({
                success:false,
                message:"User not found"
            })
            return;
        }
        if(result.rows[0].status !== "approved"){
            res.json({
                success:false,
                message:"User is not approved"
            })
            return;
        }
            pool.query(`update users set status = $1 where employee_id =$2`,
                ["deactivated",employeeId]
            )
            .then(function(){
                res.json({
                    success:true,
                    message:"User deactivated"
                })
            })
            .catch(function(error){
                console.log("Database error");
                res.json({
                    success:false,
                    message:"Database error"
                })
            })
    })
    .catch(function(error){
        console.log("Database error",error);
        res.json({
            success:false,
            message:"Database error"
        })
    })
})
app.patch("/reactivate",authenticateUser,authorizeAdmin,function(req,res){
    let employeeId = req.body.employeeId;
    console.log(req.body);
    if(!employeeId){
        res.json({
            success:false,
            message:"Provide employeeId"
        })
        return;
    }
    pool.query("select *from users where employee_id = $1 and status = $2" ,
        [employeeId,"deactivated"]
    )
    .then(function(result){
        if(result.rows.length === 0){
            res.json({
                success:false,
                message:"User not found"
            })
            return;
        }
        pool.query(`update users set status = $1 where employee_id =$2`,
            ["approved",employeeId]
        )
        .then(function(){
            res.json({
                success:true,
                message:"User reactivated"
            })
        })
        .catch(function(error){
            console.log("Database error",error);
            res.json({
                success:false,
                message:"Database error"
            })
        })
    })
    .catch(function(error){
        console.log("Database error",error);
        res.json({
            success:false,
            message:"Database error"
        })
    })
})
app.get("/get-all-users",authenticateUser,authorizeAdmin,function(req,res){
    pool.query("select *from users where status =$1 and role != $2  ",
        ["approved","admin"])
    .then(function(result){
        if(result.rows.length === 0){
            res.json({
                success:false,
                message:"No users found"
            })
            return;
        }
        res.json({
            success:true,
            users:result.rows.map(function(user){   
                return{
                    firstname:user.firstname,
                    lastname:user.lastname,
                    employee_id:user.employee_id,
                    email:user.email,
                    gender:user.gender,
                    role:user.role,
                    status:user.status
                }
            })
        })
}) 
.catch(function(error){
    console.log("Database error",error);
    res.json({
        success:false,
        message:"Database error"
    })
})
})
app.get("/get-deactivated-users",authenticateUser,authorizeAdmin,function(req,res){
    pool.query("select *from users where status = $1 and role != $2",
        ["deactivated","admin"]
    )
    .then(function(result){ 
        res.json({
            success:true,
            users:result.rows.map(function(user){
                return{
                    firstname:user.firstname,
                    lastname:user.lastname,
                    employee_id:user.employee_id,
                    email:user.email,
                    gender:user.gender,
                    role:user.role,
                    status:user.status
                }
            })
        })
    })
    .catch(function(error){
        console.log("Database error",error);
        res.json({
            success:false,
            message:"Database error"
        })
    })
})

app.listen(3000,function(){
    console.log("Server initiated");
})