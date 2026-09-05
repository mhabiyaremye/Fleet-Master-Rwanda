import "./admin.css";
import { useEffect, useState } from "react";

function AdminDashboard() {
  const [pendingusers, setPendingUsers] = useState([]);
  const [selectedRoles, setSelectedRoles] = useState({});
  const [activeSection, setActiveSection] = useState("pending-users");
  const [accountView, setAccountView] = useState("approved");
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [deactivatedUsers, setDeactivatedUsers] = useState([]);
  const [message, setMessage] = useState("");
  function getDeactivatedUsers() {
    const token = sessionStorage.getItem("token");
    fetch("http://localhost:3000/get-deactivated-users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setMessage(data.message);
          return;
        }
        setDeactivatedUsers(data.users);
      })
      .catch(function (error) {
        console.log(error);
        setMessage("An error occurred while fetching deactivated users.");
      });
  }
  function approveUser(user) {
    const selectedRole = selectedRoles[user.employee_id];
    if (!selectedRole) {
      setMessage("Please select a role for the user.");
      return;
    }
    const token = sessionStorage.getItem("token");
    fetch("http://localhost:3000/approval", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        employeeId: user.employee_id,
        role: selectedRole,
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setMessage(data.message);
          return;
        }
        removePendingUser(user);
        getApprovedUsers();
      })
      .catch(function (error) {
        console.log(error);
        setMessage("An error occurred while approving the user.");
      });
  }
  function rejectUser(user) {
    const token = sessionStorage.getItem("token");
    fetch("http://localhost:3000/rejected", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        employeeId: user.employee_id,
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setMessage(data.message);
          return;
        }
        removePendingUser(user);
      })
      .catch(function (error) {
        console.log(error);
        setMessage("An error occurred while rejecting the user.");
      });
  }
  function deactivateUser(user) {
    const token = sessionStorage.getItem("token");
    fetch("http://localhost:3000/deactivated", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        employeeId: user.employee_id,
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setMessage(data.message);
          return;
        }
        setMessage("user deactivated successfully");
        removeApprovedUser(user);
        getApprovedUsers();
        getDeactivatedUsers();
      })
      .catch(function (error) {
        console.log(error);
        setMessage("An error occurred while deactivating the user.");
      });
  }
  function reactivateUser(user) {
    const token = sessionStorage.getItem("token");
    console.log("Reactivating user:", user);
    fetch("http://localhost:3000/reactivate", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        employeeId: user.employee_id,
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setMessage(data.message);
          return;
        }
        setMessage("User reactivated successfully");
        getDeactivatedUsers();
        getApprovedUsers();
      })
      .catch(function (error) {
        console.log(error);
        setMessage("An error occurred while reactivating the user.");
      });
  }
  function removePendingUser(user) {
    setPendingUsers(
      pendingusers.filter(function (currentUser) {
        return currentUser.employee_id !== user.employee_id;
      }),
    );
  }
  function removeApprovedUser(user) {
    setApprovedUsers(
      approvedUsers.filter(function (currentUser) {
        return currentUser.employee_id !== user.employee_id;
      }),
    );
  }
  useEffect(
    function () {
      if (!message) {
        return;
      }
      const timer = setTimeout(function () {
        setMessage("");
      }, 3000);
    },
    [message],
  );
  useEffect(function () {
    const token = sessionStorage.getItem("token");
    fetch("http://localhost:3000/get-pending-users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        setMessage("");
        if (!data.success) {
          return;
        }
        setPendingUsers(data.users);
      });
  }, []);
  function getApprovedUsers() {
    const token = sessionStorage.getItem("token");
    fetch("http://localhost:3000/get-all-users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          return;
        }
        setApprovedUsers(data.users);
      });
  }
  useEffect(function () {
    getApprovedUsers();
    getDeactivatedUsers();
  }, []);
  const drivers = approvedUsers.filter(function (user) {
    return user.role === "Driver";
  }).length;
  const fleetManagers = approvedUsers.filter(function (user) {
    return user.role === "Fleet Manager";
  }).length;
  const financeManagers = approvedUsers.filter(function (user) {
    return user.role === "Finance Manager";
  }).length;
  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>Fleet Master Ops</h1>
        <p>Admin Dashboard</p>
      </header>
      <div className="admin-lay-out">
        <aside className="admin-sidebar">
          <button
            onClick={function () {
              setActiveSection("dashboard");
            }}
          >
            Dashboard
          </button>
          <button
            onClick={function () {
              setActiveSection("pending-users");
            }}
          >
            Pending users
          </button>
          <button
            onClick={function () {
              setActiveSection("account-management");
            }}
          >
            Account Management
          </button>
        </aside>
        <main className="admin-main">
          {message && <p className="message">{message}</p>}

          {activeSection === "pending-users" && (
            <section className="pending-account-requests">
              <h2>Pending Account Requests</h2>
              <div className="pending-users-header">
                <p>Full Name</p>
                <p>Employee ID</p>
                <p>Email</p>
                <p>Gender</p>
                <p>Status</p>
                <p>Role</p>
                <p>Approve</p>
                <p>Reject</p>
              </div>

              {pendingusers.map(function (user) {
                return (
                  <div className="pending-users" key={user.employee_id}>
                    <p data-label="Full Name">
                      {user.firstname} {user.lastname}
                    </p>

                    <p data-label="Employee ID">{user.employee_id}</p>

                    <p data-label="Email">{user.email}</p>

                    <p data-label="Gender">{user.gender}</p>

                    <p data-label="Status">{user.status}</p>
                    <select
                      value={selectedRoles[user.employee_id] || ""}
                      onChange={function (e) {
                        setSelectedRoles({
                          ...selectedRoles,
                          [user.employee_id]: e.target.value,
                        });
                      }}
                    >
                      <option>Select Role</option>
                      <option>Driver</option>
                      <option>Fleet Manager</option>
                      <option>Finance Manager</option>
                    </select>
                    <button
                      onClick={function () {
                        approveUser(user);
                      }}
                    >
                      Approve
                    </button>
                    <button
                      onClick={function () {
                        rejectUser(user);
                      }}
                    >
                      Reject
                    </button>
                  </div>
                );
              })}
            </section>
          )}
          {activeSection === "account-management" && (
            <section className="account-management">
              <h2>Account Management</h2>
              <div className="account-management-buttons">
                <button
                  className={accountView === "approved" ? "active" : ""}
                  onClick={function () {
                    setAccountView("approved");
                  }}
                >
                  Approved Users
                </button>
                <button
                  className={accountView === "deactivated" ? "active" : ""}
                  onClick={function () {
                    setAccountView("deactivated");
                  }}
                >
                  Deactivated Users
                </button>
              </div>
              <h3>
                {accountView === "approved"
                  ? "Approved Users"
                  : "Deactivated Users"}
              </h3>
              <p>Manage user accounts here.</p>
              {accountView === "approved" && (
                <>
                  {approvedUsers.length === 0 ? (
                    <p>No approved users found.</p>
                  ) : (
                    <>
                      <div className="approved-users-header">
                        <p>Full Name</p>
                        <p>Email</p>
                        <p>Gender</p>
                        <p>Role</p>
                        <p>Status</p>
                        <p>Action</p>
                      </div>
                      {approvedUsers.map(function (user) {
                        return (
                          <div
                            className="approved-users"
                            key={user.employee_id}
                          >
                            <p data-label="Full Name">
                              {user.firstname} {user.lastname}
                            </p>

                            <p data-label="Email">{user.email}</p>

                            <p data-label="Gender">{user.gender}</p>

                            <p data-label="Role">{user.role}</p>

                            <p data-label="Status">{user.status}</p>
                            <button
                              onClick={function () {
                                deactivateUser(user);
                              }}
                            >
                              Deactivate
                            </button>
                          </div>
                        );
                      })}
                    </>
                  )}
                </>
              )}
              {accountView === "deactivated" && (
                <>
                  <section className="deactivated-users-section">
                    {deactivatedUsers.length === 0 ? (
                      <p>No deactivated users found.</p>
                    ) : (
                      <>
                        <div className="deactivated-users-header">
                          <p>Full Name</p>
                          <p>Email</p>
                          <p>Gender</p>
                          <p>Role</p>
                          <p>Status</p>
                          <p>Action</p>
                        </div>
                        {deactivatedUsers.map(function (user) {
                          return (
                            <div
                              className="deactivated-users"
                              key={user.employee_id}
                            >
                              <p data-label="Full Name">
                                {user.firstname} {user.lastname}
                              </p>

                              <p data-label="Email">{user.email}</p>

                              <p data-label="Gender">{user.gender}</p>

                              <p data-label="Role">{user.role}</p>

                              <p data-label="Status">{user.status}</p>
                              <button
                                onClick={function () {
                                  reactivateUser(user);
                                }}
                              >
                                Activate
                              </button>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </section>
                </>
              )}
            </section>
          )}
          {activeSection === "dashboard" && (
            <section className="dashboard">
              <div className="dashboard-heading">
                <h2>Dashboard</h2>
                <p>Over view of fleet master user accounts stats</p>
              </div>
              <div className="dashboard-cards">
                <div className="dashboard-card">
                  <p>Pending users requests</p>
                  <h3>{pendingusers.length}</h3>
                </div>
                <div className="dashboard-card">
                  <p>Approved Users</p>
                  <h3>{approvedUsers.length}</h3>
                </div>
                <div className="dashboard-card">
                  <p>Deactivated Users</p>
                  <h3>{deactivatedUsers.length}</h3>
                </div>
                <div className="dashboard-card">
                  <p>Drivers</p>
                  <h3>{drivers}</h3>
                </div>
                <div className="dashboard-card">
                  <p>Fleet managers</p>
                  <h3>{fleetManagers}</h3>
                </div>
                <div className="dashboard-card">
                  <p>Finance Managers</p>
                  <h3>{financeManagers}</h3>
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default AdminDashboard;
