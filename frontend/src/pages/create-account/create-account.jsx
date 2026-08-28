import { useState } from "react";
import { Link } from "react-router-dom";
import "./create-account.css"
function CreateAccount(){
    const[firstname , setFirstName]=useState("");
    const[lastname,setLastName]=useState("");
    const[employeeid,setEmployeeId]=useState("");
    const[gender,setGender]=useState("");
    const[email,setEmail]=useState("");
    const[password,setPassword]=useState("");
    const[rpassword,setRpassword]=useState("");
    const[message,setMessage]=useState("");
    function handleRegister(event){
        event.preventDefault();
        if(password !== rpassword){
        setMessage("Passwords do not match");
        return;
        }
        fetch("http://localhost:3000/register/",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
            firstname,
            lastname,
            employeeId:employeeid,
            gender,
            email,
            password
        })    
        })
        .then(function(response){
            return response.json()
        })
        .then(function(data){
            setMessage(data.message);
        })
        .catch(function(error){
            console.log(error);
        })
}

return(
     <div className="create-account-container">
        <div className="create-account-sub-container">
        <form onSubmit={handleRegister}>
            <h2>Create Account</h2>
        <input type="text" placeholder="First name"
        value={firstname} 
        onChange={(event)=>setFirstName(event.target.value)}/>
         <input type="text"placeholder="Last name"
         value={lastname}
         onChange={(event)=>setLastName(event.target.value)} />
          <input type="number"placeholder="Employee_ID name"
          value={employeeid}
          onChange={(event)=>setEmployeeId(event.target.value)} />
          <div className="gender-group">
          <label>
            
          <input type="radio" value ="Male"
          name="gender"
          onChange={(event)=>setGender(event.target.value)}/>
        Male </label>
           <label>
           
          <input type="radio"value="Female"
          name="gender"
          onChange={(event)=>setGender(event.target.value)}/>
          Female</label>
         </div>
         <input type="text"placeholder="Email"
         value={email}
         onChange={(event)=>setEmail(event.target.value)} />
           <input type="password"placeholder="Password"
           value={password}
           onChange={(event)=>setPassword(event.target.value)} /> 
            <input type="password"placeholder="Re-type Password"
            value={rpassword}
            onChange={(event)=>setRpassword(event.target.value)} />
              <p>{message}</p>
           <button type="submit">Submit</button>
            <Link className="login-link" to="/login">already have an acount</Link>
    </form>
   
    </div>
    </div>
    

)
}
export default CreateAccount