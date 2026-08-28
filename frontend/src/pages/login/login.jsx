import { useState } from "react";
import "./login.css"
import { Link,useNavigate } from "react-router-dom";
function Login(){
const [email,setEmail]=useState("");
const [password,setPassword]=useState("")
const [message,setMessage]=useState("")
const navigate=useNavigate();
  function handleLogin(event){
  event.preventDefault();
  fetch("http://localhost:3000/login",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      email:email,
      password:password
    })
  })
  .then(function(response){
    return response.json();
  })
  .then(function(data){
    if(!data.success){
    setMessage(data.message);
    return;
    }
    sessionStorage.setItem("token",data.token);
     console.log(data)
  console.log("ROLE:", data.role)
    setMessage(data.message);
    if(data.role === "admin"){
      navigate("/admin")
    }
    if(data.role === "Driver"){
      navigate("/driver");
    }
    
    })
  .catch(function(error){
    console.log(error);
    setMessage("Unable to connect to the sever");
  })
  }
  return (
    <div className="log-in-container">
    <div className="log-in-page">
    <form onSubmit={handleLogin}>
      <h1>Fleet Master Ops</h1>
      <input type="email"placeholder='Email'value={email}
      onChange={(event)=>setEmail(event.target.value)}/>
      <input type="password"placeholder='Password'
      value={password}
      onChange={(event)=>setPassword(event.target.value)} />
      <button type="submit">Submit</button>
      <p>{message}</p>
      <Link className="authlink"to ="/create-account">Don't have an account ? signup</Link>
    </form>
    
    </div>
    </div>
  )
  }
  export default Login