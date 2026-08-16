const express=require("express");
const cors=require("cors");
const bcrypt=require("bcryptjs")
const app=express();
const {Pool}=require("pg");
const {loadEnvFile}=require("node:process");
loadEnvFile("../.env");
app.use(cors());
app.use(express.json());
const pool=new Pool({
           user:process.env.db_user,
           host:process.env.db_host,
           database:process.env.db_name,
           password:process.env.db_password,
           port:process.env.db_port
})


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
       
    if(result.rows[0].status === "pending"){
        res.json({
            success:false,
            message:"Account not approved"
        })
        return;
      }
    res.json({
        success:true,
        message:"Log in successful"
    })
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



app.listen(3000,function(){
    console.log("Server initiated");
})