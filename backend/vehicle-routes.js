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
    const currentYear = new Date().getFullYear();
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
            on conflict(plate_number)do nothing
            returning*`,
            [plate_number,make,model,year,current_odometer]

        )
        if(result.rows.length === 0){
           return res.status(400).json({
                success:false,
                message:"Plate_number already exists"
            })
        }
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
        const result = await pool.query(`SELECT
    vehicles.*,
    users.firstname,
    users.lastname
  FROM vehicles
  LEFT JOIN users
    ON vehicles.assigned_driver_id = users.employee_id
  ORDER BY vehicles.vehicle_id ASC`)
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
router.get("/approved-employees", async function (req, res) {
  try {
    const result = await pool.query(
      `SELECT employee_id, firstname, lastname
       FROM users
       WHERE status = 'approved'
       ORDER BY firstname ASC`
    );

    return res.status(200).json({
      success: true,
      employees: result.rows,
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve approved employees",
    });
  }
});
router.patch("/:vehicle_id/assign", async function (req, res) {
  try {
    const vehicleId = req.params.vehicle_id;
    const employeeId = req.body.employee_id;

    const result = await pool.query(
      `UPDATE vehicles
       SET assigned_driver_id = $1,
           status = 'in use',
           updated_at = CURRENT_TIMESTAMP
       WHERE vehicle_id = $2
       RETURNING *`,
      [employeeId, vehicleId]
    );

    return res.status(200).json({
      success: true,
      message: "Vehicle assigned successfully",
      vehicle: result.rows[0],
    });
  } catch (error) {
    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to assign vehicle",
    });
  }
});
module.exports = router;
