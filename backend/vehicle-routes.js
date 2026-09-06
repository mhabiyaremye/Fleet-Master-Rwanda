const express = require("express");
const router = express.Router();
const pool = require("./database.js");

router.post("/",async function(req,res){
    const{
        plate_number,
        make,
        model,
        year,
        current_odometer,
    }=req.body;
    const currentYear = new Date().getFullYear;

    if(!plate_number ||
        !make ||
        !model ||
        !year ||
        current_odometer === undefined
    ){
        return res.status(400).json({
            success:false,
            message:"All fields are required"
        })
    }
    if(isNaN(year) || isNaN(current_odometer)){
        return res.status(400).json({
            success:false,
            message:"Year and current odometer must be valid  numbers"
        })

    }
    if(year<1980 || year > currentYear+1){
        return res.status(400).json({
            success:false,
            message:"The year is not valid"
        })
    }
    if(current_odometer<0){
        return res.status(400).json({
            success:false,
            message:"The odometer can not be a negative number"
        })
    }
    try{
        const result = await pool.query(
            `insert into vehicles (
            plate_number,
            make,
            model,
            year,
            current_odometer)
            values(
            $1,$2,$3,$4,$5)
            returning*`,
            [plate_number,make,model,year,current_odometer]

        )
        return res.status(201).json({
            success:true,
            message:"Vehicle created successfuly",
            vehicle:result.rows[0]
        })
    }
    catch(error){
        console.log(error);
        return res.status(500).json({
            success:false,
            message:"Database Error"
        })
    }
    
});
router.get("/",async function(req,res){
    try{
        const result = await pool.query("select * from vehicles order by vehicle_id asc")
     return res.status(200).json({
        success:true,
        vehicles:result.rows
    })
    }
   
    catch(error){
         console.log(error);
        return res.status(500).json({
            success:false,
            message:"Failed to retreive vehicles"
        })
    }

})
module.exports = router;
