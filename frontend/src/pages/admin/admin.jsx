import "./admin.css"
import { useEffect, useState } from "react"

function AdminDashboard(){
    const [pendingusers,setPendingUsers]=useState([])
    useEffect(function(){
        const token=sessionStorage.getItem("token");
        fetch("http://localhost:3000/get-pending-users",{
            method:"GET",
            headers:{
                Authorization:`bearer:${token}`
            }
    })
    .then(function(response){
        return response.json();
    })
    .then(function(data){
        if(!data.sucess){
            return;
        }
        setPendingUsers(data.users);

    })

    },[]);



return(
    <div>
        <h1>Admin Dashboard</h1>
        <div>
          {pendingUsers.map(function(user){
            return (
            <p>{user.firstname}</p>
        )
        })}
        </div>
    </div>
)
}

export default AdminDashboard