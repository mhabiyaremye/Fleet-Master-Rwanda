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
  // Fuel budget draft
  const [fuelBudgetMonth, setFuelBudgetMonth] = useState(function () {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      "0",
    )}`;
  });

  const [fuelJustification, setFuelJustification] = useState("");
  const [fuelEntries, setFuelEntries] = useState({});
  const [fuelIncluded, setFuelIncluded] = useState({});
  const [fuelMessage, setFuelMessage] = useState("");
  const [fuelEnergyTypes, setFuelEnergyTypes] = useState({});

  function handleFuelEntryChange(vehicleId, field, value) {
    setFuelEntries(function (currentEntries) {
      return {
        ...currentEntries,
        [vehicleId]: {
          ...currentEntries[vehicleId],
          [field]: value,
        },
      };
    });

    setFuelMessage("");
  }
  const fuelBudgetSummary = vehicles.reduce(
    function (summary, vehicle) {
      const vehicleId = vehicle.vehicle_id;

      const isIncluded =
        fuelIncluded[vehicleId] ??
        (vehicle.status !== "out of service" &&
          vehicle.status !== "maintenance");

      if (!isIncluded) {
        return summary;
      }

      const entry = fuelEntries[vehicleId] || {};
      const energyType = fuelEnergyTypes[vehicleId] || "diesel";

      const requestedLitres = Number(entry.requestedLitres) || 0;
      const pricePerLitre = Number(entry.pricePerLitre) || 0;

      const requestedKwh = Number(entry.requestedKwh) || 0;
      const pricePerKwh = Number(entry.pricePerKwh) || 0;

      let petrolLitres = 0;
      let dieselLitres = 0;
      let hybridLitres = 0;
      let electricKwh = 0;
      let hybridKwh = 0;

      let petrolCost = 0;
      let dieselCost = 0;
      let electricCost = 0;
      let hybridFuelCost = 0;
      let hybridElectricCost = 0;

      if (energyType === "petrol") {
        petrolLitres = requestedLitres;
        petrolCost = requestedLitres * pricePerLitre;
      } else if (energyType === "diesel") {
        dieselLitres = requestedLitres;
        dieselCost = requestedLitres * pricePerLitre;
      } else if (energyType === "electric") {
        electricKwh = requestedKwh;
        electricCost = requestedKwh * pricePerKwh;
      } else if (energyType === "hybrid") {
        hybridLitres = requestedLitres;
        hybridKwh = requestedKwh;

        hybridFuelCost = requestedLitres * pricePerLitre;
        hybridElectricCost = requestedKwh * pricePerKwh;
      }

      return {
        vehicleCount: summary.vehicleCount + 1,

        petrolLitres: summary.petrolLitres + petrolLitres,
        dieselLitres: summary.dieselLitres + dieselLitres,
        hybridLitres: summary.hybridLitres + hybridLitres,

        electricKwh: summary.electricKwh + electricKwh,
        hybridKwh: summary.hybridKwh + hybridKwh,

        petrolCost: summary.petrolCost + petrolCost,
        dieselCost: summary.dieselCost + dieselCost,
        electricCost: summary.electricCost + electricCost,
        hybridFuelCost: summary.hybridFuelCost + hybridFuelCost,
        hybridElectricCost: summary.hybridElectricCost + hybridElectricCost,

        totalCost:
          summary.totalCost +
          petrolCost +
          dieselCost +
          electricCost +
          hybridFuelCost +
          hybridElectricCost,
      };
    },
    {
      vehicleCount: 0,

      petrolLitres: 0,
      dieselLitres: 0,
      hybridLitres: 0,

      electricKwh: 0,
      hybridKwh: 0,

      petrolCost: 0,
      dieselCost: 0,
      electricCost: 0,
      hybridFuelCost: 0,
      hybridElectricCost: 0,

      totalCost: 0,
    },
  );

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

          <button
            className={fleetView === "fuel-planning" ? "active" : ""}
            onClick={() => setFleetView("fuel-planning")}
          >
            Fuel Planning
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

        {fleetView === "fuel-planning" && (
          <section className="fuel-planning-section">
            <div className="fuel-planning-header">
              <h2>Monthly Fuel Planning</h2>
              <p>
                Prepare and review your fleet's monthly fuel requirements before
                submitting a proposal to Finance.
              </p>
            </div>

            <div className="fuel-planning-form">
              <div className="fuel-form-group">
                <label htmlFor="fuel-budget-month">Budget Month</label>

                <input
                  id="fuel-budget-month"
                  type="month"
                  value={fuelBudgetMonth}
                  onChange={(event) => setFuelBudgetMonth(event.target.value)}
                />
              </div>

              <div className="fuel-form-group">
                <label htmlFor="fuel-justification">
                  Operational Justification
                </label>

                <textarea
                  id="fuel-justification"
                  value={fuelJustification}
                  onChange={(event) => setFuelJustification(event.target.value)}
                  placeholder="Explain the operational needs behind this month's fuel request..."
                  rows={4}
                />
              </div>
            </div>

            <div className="fuel-budget-summary">
              <div className="fuel-summary-card">
                <span>Vehicles Included</span>
                <strong>{fuelBudgetSummary.vehicleCount}</strong>
              </div>

              {fuelBudgetSummary.petrolLitres > 0 && (
                <div className="fuel-summary-card">
                  <span>Petrol Budget</span>
                  <strong>
                    {fuelBudgetSummary.petrolCost.toLocaleString("en-RW")} RWF
                  </strong>
                  <small>
                    {fuelBudgetSummary.petrolLitres.toLocaleString("en-RW")} L
                    required
                  </small>
                </div>
              )}

              {fuelBudgetSummary.dieselLitres > 0 && (
                <div className="fuel-summary-card">
                  <span>Diesel Budget</span>
                  <strong>
                    {fuelBudgetSummary.dieselCost.toLocaleString("en-RW")} RWF
                  </strong>
                  <small>
                    {fuelBudgetSummary.dieselLitres.toLocaleString("en-RW")} L
                    required
                  </small>
                </div>
              )}

              {fuelBudgetSummary.electricKwh > 0 && (
                <div className="fuel-summary-card">
                  <span>Electricity Budget</span>
                  <strong>
                    {fuelBudgetSummary.electricCost.toLocaleString("en-RW")} RWF
                  </strong>
                  <small>
                    {fuelBudgetSummary.electricKwh.toLocaleString("en-RW")} kWh
                    required
                  </small>
                </div>
              )}

              {(fuelBudgetSummary.hybridLitres > 0 ||
                fuelBudgetSummary.hybridKwh > 0) && (
                <div className="fuel-summary-card">
                  <span>Hybrid Budget</span>
                  <strong>
                    {(
                      fuelBudgetSummary.hybridFuelCost +
                      fuelBudgetSummary.hybridElectricCost
                    ).toLocaleString("en-RW")}{" "}
                    RWF
                  </strong>
                  <small>
                    {fuelBudgetSummary.hybridLitres.toLocaleString("en-RW")} L
                    fuel
                    {" · "}
                    {fuelBudgetSummary.hybridKwh.toLocaleString("en-RW")} kWh
                    electricity
                  </small>
                </div>
              )}

              <div className="fuel-summary-card fuel-summary-total">
                <span>Total Estimated Budget</span>
                <strong>
                  {fuelBudgetSummary.totalCost.toLocaleString("en-RW")} RWF
                </strong>
              </div>
            </div>

            <div className="fuel-vehicle-requirements">
              <h3>Vehicle Fuel Requirements</h3>
              <p>
                Select the vehicles to include and enter the estimated monthly
                fuel requirements for each.
              </p>

              {vehicles.length === 0 ? (
                <p>
                  No vehicles are available. Add vehicles before preparing a
                  fuel plan.
                </p>
              ) : (
                vehicles.map((vehicle) => {
                  const entry = fuelEntries[vehicle.vehicle_id] || {};

                  const included =
                    fuelIncluded[vehicle.vehicle_id] ??
                    (vehicle.status !== "out of service" &&
                      vehicle.status !== "maintenance");

                  const energyType =
                    fuelEnergyTypes[vehicle.vehicle_id] || "diesel";

                  const fuelCost =
                    (Number(entry.requestedLitres) || 0) *
                    (Number(entry.pricePerLitre) || 0);

                  const electricCost =
                    (Number(entry.requestedKwh) || 0) *
                    (Number(entry.pricePerKwh) || 0);

                  const estimatedCost =
                    energyType === "electric"
                      ? electricCost
                      : energyType === "hybrid"
                        ? fuelCost + electricCost
                        : fuelCost;

                  return (
                    <div className="fuel-vehicle-card" key={vehicle.vehicle_id}>
                      <div className="fuel-vehicle-heading">
                        <label>
                          <input
                            type="checkbox"
                            checked={included}
                            onChange={(event) => {
                              setFuelIncluded((current) => ({
                                ...current,
                                [vehicle.vehicle_id]: event.target.checked,
                              }));
                              setFuelMessage("");
                            }}
                          />
                          <strong>{vehicle.plate_number}</strong>
                        </label>

                        <span>{vehicle.status}</span>
                      </div>

                      <p>
                        {vehicle.make} {vehicle.model}
                      </p>

                      <div className="fuel-form-group">
                        <label htmlFor={`energy-type-${vehicle.vehicle_id}`}>
                          Energy Type
                        </label>

                        <select
                          id={`energy-type-${vehicle.vehicle_id}`}
                          value={
                            fuelEnergyTypes[vehicle.vehicle_id] || "diesel"
                          }
                          disabled={!included}
                          onChange={(event) => {
                            setFuelEnergyTypes((current) => ({
                              ...current,
                              [vehicle.vehicle_id]: event.target.value,
                            }));

                            setFuelMessage("");
                          }}
                        >
                          <option value="petrol">Petrol</option>
                          <option value="diesel">Diesel</option>
                          <option value="electric">Electric</option>
                          <option value="hybrid">Hybrid</option>
                        </select>
                      </div>

                      <div className="fuel-vehicle-inputs">
                        {(energyType === "petrol" ||
                          energyType === "diesel" ||
                          energyType === "hybrid") && (
                          <>
                            <div className="fuel-form-group">
                              <label
                                htmlFor={`fuel-litres-${vehicle.vehicle_id}`}
                              >
                                Requested Litres
                              </label>

                              <input
                                id={`fuel-litres-${vehicle.vehicle_id}`}
                                type="number"
                                min="0"
                                step="any"
                                value={entry.requestedLitres ?? ""}
                                disabled={!included}
                                onChange={(event) =>
                                  handleFuelEntryChange(
                                    vehicle.vehicle_id,
                                    "requestedLitres",
                                    event.target.value,
                                  )
                                }
                                placeholder="e.g. 80"
                              />
                            </div>

                            <div className="fuel-form-group">
                              <label
                                htmlFor={`fuel-price-${vehicle.vehicle_id}`}
                              >
                                Estimated Price per Litre (RWF)
                              </label>

                              <input
                                id={`fuel-price-${vehicle.vehicle_id}`}
                                type="number"
                                min="0"
                                step="any"
                                value={entry.pricePerLitre ?? ""}
                                disabled={!included}
                                onChange={(event) =>
                                  handleFuelEntryChange(
                                    vehicle.vehicle_id,
                                    "pricePerLitre",
                                    event.target.value,
                                  )
                                }
                                placeholder="e.g. 1800"
                              />
                            </div>
                          </>
                        )}

                        {(energyType === "electric" ||
                          energyType === "hybrid") && (
                          <>
                            <div className="fuel-form-group">
                              <label htmlFor={`fuel-kwh-${vehicle.vehicle_id}`}>
                                Requested Electricity (kWh)
                              </label>

                              <input
                                id={`fuel-kwh-${vehicle.vehicle_id}`}
                                type="number"
                                min="0"
                                step="any"
                                value={entry.requestedKwh ?? ""}
                                disabled={!included}
                                onChange={(event) =>
                                  handleFuelEntryChange(
                                    vehicle.vehicle_id,
                                    "requestedKwh",
                                    event.target.value,
                                  )
                                }
                                placeholder="e.g. 150"
                              />
                            </div>

                            <div className="fuel-form-group">
                              <label
                                htmlFor={`fuel-kwh-price-${vehicle.vehicle_id}`}
                              >
                                Estimated Price per kWh (RWF)
                              </label>

                              <input
                                id={`fuel-kwh-price-${vehicle.vehicle_id}`}
                                type="number"
                                min="0"
                                step="any"
                                value={entry.pricePerKwh ?? ""}
                                disabled={!included}
                                onChange={(event) =>
                                  handleFuelEntryChange(
                                    vehicle.vehicle_id,
                                    "pricePerKwh",
                                    event.target.value,
                                  )
                                }
                                placeholder="e.g. 250"
                              />
                            </div>
                          </>
                        )}
                      </div>

                      <div className="fuel-vehicle-estimate">
                        Estimated cost:{" "}
                        <strong>
                          {(included ? estimatedCost : 0).toLocaleString(
                            "en-RW",
                          )}{" "}
                          RWF
                        </strong>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {fuelMessage && (
              <p className="fuel-planning-message" role="status">
                {fuelMessage}
              </p>
            )}

            <p className="fuel-planning-note">
              This is a local draft. It has not been submitted to Finance or
              saved to the server.
            </p>
          </section>
        )}
      </div>
    </>
  );
}

export default FleetManager;
