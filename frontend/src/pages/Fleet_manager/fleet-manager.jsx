import { useState, useEffect } from "react";
import "./fleet-manager.css";
function FleetManager() {
  const [vehicles, setVehicles] = useState([]);
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
  return (
    <>
      <div className="fleet-manager-dashboard">
        <h1>Fleet manager dashboard</h1>
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
        <section className="vehicle-list">
          <div className="vehicle-header">
            <p>Plate Number</p>
            <p>Make</p>
            <p>Model</p>
            <p>Year</p>
            <p>Odometer</p>
            <p>Status</p>
            <p>Assigned Driver</p>
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
                    {vehicle.assigned_driver_id}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}

export default FleetManager;
