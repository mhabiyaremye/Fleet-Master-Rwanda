import "./admin.css"
import { useEffect, useState } from "react"

function AdminDashboard(){
    const [pendingusers,setPendingUsers]=useState([])
    const[selectedRoles,setSelectedRoles]=useState({});
    const [activeSection,setActiveSection]=useState("pending-users");
    const [approvedUsers,setApprovedUsers]=useState([]);
    function approveUser(user){
        if(!selectedRoles){
            return;
        }
        const token=sessionStorage.getItem("token");
        fetch("http://localhost:3000/approval",{
            method:"PATCH",
            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${token}`
            },
            body:JSON.stringify({
            employeeId: user.employee_id,
                role: selectedRoles[user.employee_id]
            })
        })
        .then(function(response){
            return response.json();
        })
        .then(function(data){
            if(!data.success){
                console.log(data.message);
                 return;
            }
             removePendingUser(user);    
        })
        .catch(function(error){
            console.error("Error approving user:", error);
        })   
    }
    function rejectUser(user){
        const token=sessionStorage.getItem("token");
        fetch("http://localhost:3000/rejected",{
            method:"PATCH",
            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${token}`
            },
            body:JSON.stringify({
                employeeId: user.employee_id
            })
        })
        .then(function(response){
            return response.json();
        })
        .then(function(data){
            if(!data.success){
              console.log(data.message);
               return;
            }
            removePendingUser(user);
           
        })
        .catch(function(error){
            console.error("Error rejecting user:", error);
        })
    }
    function deactivateUser(user){
        const token=sessionStorage.getItem("token");
        fetch("http://localhost:3000/deactivated",{
            method:"PATCH",
            headers:{
                "Content-Type":"application/json",
                Authorization:`Bearer ${token}`
            },
            body:JSON.stringify({
                employeeId: user.employee_id
            })
        })
        .then(function(response){
            return response.json();
        })
        .then(function(data){
            if(!data.success){
                console.log(data.message);
            }
            return;
        })
        .catch(function(error){
            console.error("Error deactivating user:", error);
        })
    }
   function removePendingUser(user){
    setPendingUsers(pendingusers.filter(function(currentUser){
        return currentUser.employee_id!==user.employee_id;
    }))
   }
    useEffect(function(){
        const token=sessionStorage.getItem("token");
        fetch("http://localhost:3000/get-pending-users",{
            method:"GET",
            headers:{
                Authorization:`Bearer ${token}`
            }
    })
    .then(function(response){
        return response.json();
    })
    .then(function(data){
  
        if(!data.success){
            return;
        }
        setPendingUsers(data.users);

    })

    },[]);
    useEffect(function(){
        const token=sessionStorage.getItem("token");
        fetch("http://localhost:3000/get-all-users",{
            method:"GET",
            headers:{
                Authorization:`Bearer ${token}`
            }
        })
        .then(function(response){
            return response.json();
        })
        .then(function(data){
            if(!data.success){
                return;
            }
            setApprovedUsers(data.users);
        })
    },[]);

return(
    <div className="admin-dashboard">
        <header className="admin-header">
        <h1>Fleet Master Ops</h1>
        <p>Admin Dashboard</p>
        </header>
        <div className="admin-lay-out">
            <aside className="admin-sidebar">
                <p>Dashboard</p>
                <button onClick={function(){setActiveSection("pending-users")}}>Pending users</button>
                <button onClick={function(){setActiveSection("account-management")}}>Account Management</button>
            </aside>
            <main className="admin-main">
                {activeSection==="pending-users" && (
                <section className="pending-account-requests">
                <h2>Pending Account Requests</h2>
          {pendingusers.map(function(user){
            return (
                <div className="pending-users" key={user.employee_id}>
            <p>{user.firstname} {user.lastname}</p>
            <p>{user.gender}</p>
            <p>{user.role}</p>
            <p>{user.status}</p>

            <select value={selectedRoles[user.employee_id] || ""}
            onChange={function(e){setSelectedRoles({...selectedRoles,[user.employee_id]:e.target.value})}}>
                <option>Select Role</option>
                <option>Driver</option>
                <option>Fleet Manager</option>
                <option>Finance Manager</option>
            </select>
            <button onClick={function(){approveUser(user)}}>Approve</button>
            <button onClick={function(){rejectUser(user)}}>Reject</button>

            </div>
           
        )
        })}
        </section>
                )}
                {activeSection==="account-management" && (
                <section className="account-management">
                    <h2>Account Management</h2>
                    <p>Manage user accounts here.</p>
                    {approvedUsers.map(function(user){
                        return(
                            <div className="approved-users" key={user.employee_id}>
                                <p>{user.firstname} {user.lastname}</p>
                                <p>{user.email}</p>
                                <p>{user.gender}</p>
                                <p>{user.role}</p>
                                <p>{user.status}</p>
                                <button onClick={function(){deactivateUser(user)}}>Deactivate</button>
                            </div>
                            
                        )
                    })} 
                </section>
                )}
         </main>
        </div>
    </div>
)
}

export default AdminDashboard