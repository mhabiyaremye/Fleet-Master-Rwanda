import { useState, useEffect } from "react";
import "./fleet-manager.css";
function FleetManager() {
  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [currentOdometer, setCurrentOdometer] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [fleetView, setFleetView] = useState("overview");
  const [message, setMessage] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [assignmentSuccess, setAssignmentSuccess] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");

  const [maintenanceVehicleId, setMaintenanceVehicleId] = useState("");
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);

  const [maintenanceType, setMaintenanceType] = useState("");
  const [maintenanceDescription, setMaintenanceDescription] = useState("");
  const [maintenanceDate, setMaintenanceDate] = useState("");
  const [maintenanceOdometer, setMaintenanceOdometer] = useState("");
  const [maintenanceCost, setMaintenanceCost] = useState("");

  useEffect(function () {
    fetch("http://localhost:3000/vehicles")
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          return;
        }
        setVehicles(data.vehicles);
      })
      .catch(function (error) {
        console.log(error);
      });
  }, []);
  console.log(vehicles);
  const availableVehicles = vehicles.filter(function (vehicle) {
    return vehicle.status === "available";
  }).length;
  const vehiclesInuse = vehicles.filter(function (vehicle) {
    return vehicle.status === "in use";
  }).length;
  const vehiclesOutofService = vehicles.filter(function (vehicle) {
    return vehicle.status === "out of service";
  }).length;
  const vehiclesInmaintenance = vehicles.filter(function (vehicle) {
    return vehicle.status === "maintenance";
  }).length;
  function handleAddVehicle(event) {
    setMessage("");
    event.preventDefault();

    fetch("http://localhost:3000/vehicles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        plate_number: plateNumber,
        make: make,
        model: model,
        year: year,
        current_odometer: currentOdometer,
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        console.log(data);
        if (!data.success) {
          setMessage(data.message);
          setTimeout(function () {
            setMessage("");
          }, 3000);
          return;
        }
        setVehicles(function (currentVehicles) {
          return [...currentVehicles, data.vehicle];
        });
        setMessage(data.message);
        setTimeout(function () {
          setMessage("");
        }, 3000);
        setPlateNumber("");
        setMake("");
        setModel("");
        setYear("");
        setCurrentOdometer("");
      })
      .catch(function (error) {
        console.log(error);
        setMessage("Unable to connect to the server");
        setTimeout(function () {
          setMessage("");
        }, 5000);
      });
  }
  function handleAssignVehicle(vehicle) {
    setSelectedVehicle(vehicle);
    setAssignmentMessage("");

    fetch("http://localhost:3000/vehicles/approved-employees")
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          return;
        }

        setEmployees(data.employees);
      })
      .catch(function (error) {
        console.log(error);
      });
  }
  function handleSubmitAssignment() {
    if (!selectedVehicle || !selectedEmployee) {
      return;
    }

    fetch(
      `http://localhost:3000/vehicles/${selectedVehicle.vehicle_id}/assign`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employee_id: selectedEmployee,
        }),
      },
    )
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        console.log(data);
        const assignedVehicle = data.vehicle;
        if (data.success === false) {
          setAssignmentSuccess(false);
          setAssignmentMessage(data.message);
        } else {
          setAssignmentSuccess(true);
          setVehicles(function (currentVehicles) {
            return currentVehicles.map(function (currentVehicle) {
              if (currentVehicle.vehicle_id === assignedVehicle.vehicle_id) {
                return assignedVehicle;
              }
              return currentVehicle;
            });
          });
        }
      })
      .catch(function (error) {
        console.log(error);
      });
  }

  function handleLoadMaintenanceHistory(vehicleId) {
    setMaintenanceVehicleId(vehicleId);
    setMaintenanceRecords([]);
    setMaintenanceMessage("");
    setMaintenanceLoading(true);

    const token = sessionStorage.getItem("token");

    fetch(`http://localhost:3000/vehicles/${vehicleId}/maintenance`, {
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
          setMaintenanceMessage(
            data.message || "Unable to load maintenance history",
          );
          return;
        }

        setMaintenanceRecords(data.maintenance_records);
      })
      .catch(function (error) {
        console.error("Failed to load maintenance history:", error);
        setMaintenanceMessage("Unable to connect to the server");
      })
      .finally(function () {
        setMaintenanceLoading(false);
      });
  }

  function handleStartMaintenance(event) {
    event.preventDefault();

    setMaintenanceMessage("");

    if (!maintenanceVehicleId) {
      setMaintenanceMessage("Please select a vehicle.");
      return;
    }

    setMaintenanceLoading(true);

    const token = sessionStorage.getItem("token");

    fetch(
      `http://localhost:3000/vehicles/${maintenanceVehicleId}/maintenance`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          maintenance_type: maintenanceType,
          description: maintenanceDescription,
          maintenance_date: maintenanceDate,
          odometer_reading: Number(maintenanceOdometer),
          cost: maintenanceCost === "" ? 0 : Number(maintenanceCost),
        }),
      },
    )
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setMaintenanceMessage(data.message || "Failed to start maintenance.");
          return;
        }

        setMaintenanceMessage(data.message);

        // Update the vehicle status in React state.
        setVehicles(function (currentVehicles) {
          return currentVehicles.map(function (vehicle) {
            if (vehicle.vehicle_id === Number(maintenanceVehicleId)) {
              return {
                ...vehicle,
                status: "maintenance",
                assigned_driver_id: null,
                current_odometer: Number(maintenanceOdometer),
              };
            }

            return vehicle;
          });
        });

        // Clear the form after successful submission.
        setMaintenanceType("");
        setMaintenanceDescription("");
        setMaintenanceDate("");
        setMaintenanceOdometer("");
        setMaintenanceCost("");

        // Reload the history for the selected vehicle.
        handleLoadMaintenanceHistory(maintenanceVehicleId);
      })
      .catch(function (error) {
        console.error("Failed to start maintenance:", error);
        setMaintenanceMessage("Unable to connect to the server.");
      })
      .finally(function () {
        setMaintenanceLoading(false);
      });
  }
  function handleCompleteMaintenance(record) {
    setMaintenanceMessage("");

    const token = sessionStorage.getItem("token");

    fetch(
      `http://localhost:3000/vehicles/${maintenanceVehicleId}/maintenance/${record.maintenance_id}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "completed",
        }),
      },
    )
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setMaintenanceMessage(
            data.message || "Failed to complete maintenance.",
          );
          return;
        }

        setMaintenanceMessage(
          data.message || "Maintenance completed successfully.",
        );

        handleLoadMaintenanceHistory(maintenanceVehicleId);
      })
      .catch(function (error) {
        console.error("Failed to complete maintenance:", error);
        setMaintenanceMessage("Unable to connect to the server.");
      });
  }
  function handleConfirmVehicleReady(record) {
    setMaintenanceMessage("");

    const token = sessionStorage.getItem("token");

    fetch(
      `http://localhost:3000/vehicles/${maintenanceVehicleId}/maintenance/${record.maintenance_id}/confirm-ready`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    )
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setMaintenanceMessage(
            data.message || "Failed to confirm vehicle readiness.",
          );
          return;
        }

        setMaintenanceMessage(
          data.message || "Vehicle readiness confirmed successfully.",
        );

        handleLoadMaintenanceHistory(maintenanceVehicleId);

        // Refresh the vehicle list to show its latest status.
        fetch("http://localhost:3000/vehicles", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
          .then(function (response) {
            return response.json();
          })
          .then(function (vehicleData) {
            if (vehicleData.success) {
              setVehicles(vehicleData.vehicles);
            }
          })
          .catch(function (error) {
            console.error("Failed to refresh vehicles:", error);
          });
      })
      .catch(function (error) {
        console.error("Failed to confirm vehicle readiness:", error);
        setMaintenanceMessage("Unable to connect to the server.");
      });
  }

  return (
    <>
      <div className="fleet-manager-dashboard">
        <h1>Fleet manager dashboard</h1>
        <div className="fleet-manager-nav">
          <button
            className={fleetView === "overview" ? "active" : ""}
            onClick={() => setFleetView("overview")}
          >
            Overview
          </button>

          <button
            className={fleetView === "vehicles" ? "active" : ""}
            onClick={() => setFleetView("vehicles")}
          >
            Vehicles
          </button>

          <button
            className={fleetView === "add-vehicle" ? "active" : ""}
            onClick={() => setFleetView("add-vehicle")}
          >
            Add Vehicle
          </button>

          <button
            className={fleetView === "maintenance" ? "active" : ""}
            onClick={() => setFleetView("maintenance")}
          >
            Maintenance
          </button>
        </div>
        {fleetView === "overview" && (
          <section className="fleet-status-overview">
            <div className="status-card">
              <p className="status-label">Available Vehicles</p>
              <p className="status-value">{availableVehicles}</p>
            </div>

            <div className="status-card">
              <p className="status-label">Vehicles In Use</p>
              <p className="status-value">{vehiclesInuse}</p>
            </div>

            <div className="status-card">
              <p className="status-label">Out of Service</p>
              <p className="status-value">{vehiclesOutofService}</p>
            </div>

            <div className="status-card">
              <p className="status-label">Under Maintenance</p>
              <p className="status-value">{vehiclesInmaintenance}</p>
            </div>
          </section>
        )}
        {fleetView === "vehicles" && (
          <section className="vehicle-list">
            <div className="vehicle-header">
              <p>Plate Number</p>
              <p>Make</p>
              <p>Model</p>
              <p>Year</p>
              <p>Odometer</p>
              <p>Status</p>
              <p>Assigned Driver</p>
              <p>Action</p>
            </div>
            <div>
              {vehicles.map(function (vehicle) {
                return (
                  <div className="vehicle-row" key={vehicle.vehicle_id}>
                    <p data-label="Plate Number">{vehicle.plate_number}</p>
                    <p data-label="Make">{vehicle.make}</p>
                    <p data-label="Model">{vehicle.model}</p>
                    <p data-label="Year">{vehicle.year}</p>
                    <p data-label="Odometer">{vehicle.current_odometer}</p>
                    <p data-label="Status">{vehicle.status}</p>
                    <p data-label="Assigned Driver">
                      {vehicle.assigned_driver_id
                        ? `${vehicle.firstname} ${vehicle.lastname} (${vehicle.assigned_driver_id})`
                        : "Unassigned"}
                    </p>

                    <p data-label="Action">
                      <p data-label="Action">
                        {!vehicle.assigned_driver_id && (
                          <button
                            type="button"
                            onClick={function () {
                              handleAssignVehicle(vehicle);
                            }}
                          >
                            Assign Driver
                          </button>
                        )}
                      </p>
                    </p>
                  </div>
                );
              })}
              {selectedVehicle && (
                <div className="assignment-modal-overlay">
                  <div className="assignment-modal">
                    {!assignmentSuccess ? (
                      <>
                        <h2>Assign Vehicle</h2>

                        <p>Vehicle: {selectedVehicle.plate_number}</p>

                        <select
                          value={selectedEmployee}
                          onChange={function (event) {
                            setSelectedEmployee(event.target.value);
                            setAssignmentMessage("");
                            console.log(
                              "Selected employee:",
                              event.target.value,
                            );
                          }}
                        >
                          <option value="">Select Employee</option>

                          {employees.map(function (employee) {
                            return (
                              <option
                                key={employee.employee_id}
                                value={employee.employee_id}
                              >
                                {employee.firstname} {employee.lastname} (
                                {employee.employee_id})
                              </option>
                            );
                          })}
                        </select>
                        <p className="assignment-message">
                          {assignmentMessage}
                        </p>

                        <button type="button" onClick={handleSubmitAssignment}>
                          Assign
                        </button>

                        <button
                          type="button"
                          onClick={function () {
                            setSelectedVehicle(null);
                            setSelectedEmployee("");
                            setAssignmentMessage("");
                          }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <div className="assignment-success">
                        <h2>Vehicle Assigned Successfully</h2>

                        <p>The vehicle has been assigned successfully.</p>

                        <button
                          type="button"
                          onClick={function () {
                            setAssignmentSuccess(false);
                            setSelectedVehicle(null);
                            setSelectedEmployee("");
                          }}
                        >
                          Done
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
        {fleetView === "add-vehicle" && (
          <section>
            <form className="add-vehicle-form" onSubmit={handleAddVehicle}>
              <input
                type="text"
                placeholder="Plate Number"
                value={plateNumber}
                onChange={function (event) {
                  setPlateNumber(event.target.value);
                }}
              />

              <input
                type="text"
                placeholder="Make"
                value={make}
                onChange={function (event) {
                  setMake(event.target.value);
                }}
              />

              <input
                type="text"
                placeholder="Model"
                value={model}
                onChange={function (event) {
                  setModel(event.target.value);
                }}
              />

              <input
                type="number"
                placeholder="Year"
                value={year}
                onChange={function (event) {
                  setYear(event.target.value);
                }}
              />

              <input
                type="number"
                placeholder="Current Odometer"
                value={currentOdometer}
                onChange={function (event) {
                  setCurrentOdometer(event.target.value);
                }}
              />

              <button type="submit">Add Vehicle</button>
              {message && <p className="message">{message}</p>}
            </form>
          </section>
        )}

        {/* Vehicle Maintenance */}
        {fleetView === "maintenance" && (
          <section className="maintenance-section">
            <div className="maintenance-header">
              <h2>Vehicle Maintenance</h2>
              <p>Manage vehicle servicing, repairs, and maintenance history.</p>
            </div>

            <div className="maintenance-panel">
              <h3>Select Vehicle</h3>

              <label htmlFor="maintenance-vehicle">Vehicle</label>

              <select
                id="maintenance-vehicle"
                value={maintenanceVehicleId}
                onChange={function (event) {
                  const vehicleId = event.target.value;

                  if (vehicleId) {
                    handleLoadMaintenanceHistory(vehicleId);
                  } else {
                    setMaintenanceVehicleId("");
                    setMaintenanceRecords([]);
                    setMaintenanceMessage("");
                  }
                }}
              >
                <option value="">Choose a vehicle</option>

                {vehicles.map(function (vehicle) {
                  return (
                    <option key={vehicle.vehicle_id} value={vehicle.vehicle_id}>
                      {vehicle.plate_number} — {vehicle.make} {vehicle.model}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="maintenance-panel">
              <h3>Start Maintenance</h3>

              <form
                className="maintenance-form"
                onSubmit={handleStartMaintenance}
              >
                <label htmlFor="maintenance-type">Maintenance Type</label>
                <select
                  id="maintenance-type"
                  value={maintenanceType}
                  onChange={function (event) {
                    setMaintenanceType(event.target.value);
                  }}
                  required
                >
                  <option value="">Select maintenance type</option>
                  <option value="Routine Service">Routine Service</option>
                  <option value="Oil Change">Oil Change</option>
                  <option value="Repair">Repair</option>
                  <option value="Tire Replacement">Tire Replacement</option>
                  <option value="Inspection">Inspection</option>
                  <option value="Other">Other</option>
                </select>

                <label htmlFor="maintenance-date">Maintenance Date</label>
                <input
                  id="maintenance-date"
                  type="date"
                  value={maintenanceDate}
                  onChange={function (event) {
                    setMaintenanceDate(event.target.value);
                  }}
                  required
                />

                <label htmlFor="maintenance-odometer">Odometer Reading</label>
                <input
                  id="maintenance-odometer"
                  type="number"
                  min="0"
                  step="1"
                  value={maintenanceOdometer}
                  onChange={function (event) {
                    setMaintenanceOdometer(event.target.value);
                  }}
                  placeholder="Enter odometer reading"
                  required
                />

                <label htmlFor="maintenance-cost">Maintenance Cost (RWF)</label>
                <input
                  id="maintenance-cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={maintenanceCost}
                  onChange={function (event) {
                    setMaintenanceCost(event.target.value);
                  }}
                  placeholder="Enter cost (optional)"
                />

                <label htmlFor="maintenance-description">Description</label>
                <textarea
                  id="maintenance-description"
                  value={maintenanceDescription}
                  onChange={function (event) {
                    setMaintenanceDescription(event.target.value);
                  }}
                  placeholder="Describe the maintenance work..."
                  rows="4"
                  required
                />

                <button
                  type="submit"
                  disabled={!maintenanceVehicleId || maintenanceLoading}
                >
                  {maintenanceLoading ? "Processing..." : "Start Maintenance"}
                </button>
              </form>
            </div>

            <div className="maintenance-history">
              <h3>Maintenance History</h3>

              {maintenanceLoading && <p>Loading maintenance history...</p>}

              {maintenanceMessage && (
                <p className="maintenance-message">{maintenanceMessage}</p>
              )}

              {!maintenanceLoading &&
                maintenanceVehicleId &&
                maintenanceRecords.length === 0 &&
                !maintenanceMessage && (
                  <p>No maintenance records found for this vehicle.</p>
                )}

              {!maintenanceVehicleId && (
                <p>Select a vehicle to view its maintenance history.</p>
              )}

              {maintenanceRecords.length > 0 && (
                <div className="maintenance-record-list">
                  {maintenanceRecords.map(function (record) {
                    return (
                      <article
                        className="maintenance-record"
                        key={record.maintenance_id}
                      >
                        <div className="maintenance-record-header">
                          <h4>{record.maintenance_type}</h4>
                          <span className="maintenance-status">
                            {record.status}
                          </span>
                        </div>
                        <div className="maintenance-record-actions">
                          {record.status !== "completed" &&
                            record.status !== "cancelled" &&
                            !record.ready_confirmed_at && (
                              <button
                                type="button"
                                onClick={function () {
                                  handleCompleteMaintenance(record);
                                }}
                              >
                                Complete Maintenance
                              </button>
                            )}

                          {record.status === "completed" &&
                            !record.ready_confirmed_at && (
                              <button
                                type="button"
                                onClick={function () {
                                  handleConfirmVehicleReady(record);
                                }}
                              >
                                Confirm Vehicle Ready
                              </button>
                            )}

                          {record.ready_confirmed_at && (
                            <p>Vehicle readiness confirmed.</p>
                          )}
                        </div>

                        <p>{record.description}</p>

                        <div className="maintenance-record-details">
                          <p>
                            <strong>Date:</strong>{" "}
                            {record.maintenance_date
                              ? String(record.maintenance_date).slice(0, 10)
                              : "Not provided"}
                          </p>

                          <p>
                            <strong>Odometer:</strong> {record.odometer_reading}
                          </p>

                          <p>
                            <strong>Cost:</strong>{" "}
                            {Number(record.cost || 0).toLocaleString()} RWF
                          </p>

                          <p>
                            <strong>Completed:</strong>{" "}
                            {record.completed_at
                              ? String(record.completed_at).slice(0, 10)
                              : "Not completed"}
                          </p>

                          <p>
                            <strong>Readiness:</strong>{" "}
                            {record.ready_confirmed_at
                              ? "Confirmed"
                              : "Awaiting confirmation"}
                          </p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

export default FleetManager;
