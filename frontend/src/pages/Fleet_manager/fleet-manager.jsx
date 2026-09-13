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
      })
      .catch(function (error) {
        console.log(error);
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

                        <button type="button" onClick={handleSubmitAssignment}>
                          Assign
                        </button>

                        <button
                          type="button"
                          onClick={function () {
                            setSelectedVehicle(null);
                            setSelectedEmployee("");
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
      </div>
    </>
  );
}

export default FleetManager;
