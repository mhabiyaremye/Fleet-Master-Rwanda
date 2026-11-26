export default function MaintenancePanel({
  vehicles,
  maintenanceVehicleId,
  setMaintenanceVehicleId,
  maintenanceRecords,
  setMaintenanceRecords,
  maintenanceMessage,
  setMaintenanceMessage,
  maintenanceLoading,
  maintenanceType,
  setMaintenanceType,
  maintenanceDescription,
  setMaintenanceDescription,
  maintenanceDate,
  setMaintenanceDate,
  maintenanceOdometer,
  setMaintenanceOdometer,
  maintenanceCost,
  setMaintenanceCost,
  handleLoadMaintenanceHistory,
  handleStartMaintenance,
  handleCompleteMaintenance,
  handleConfirmVehicleReady,
}) {
  return (
    <section className="maintenance-section">
      <div className="maintenance-header">
        <h2>Vehicle Maintenance</h2>

        <p>
          Manage vehicle servicing, repairs, and maintenance history.
        </p>
      </div>

      {/* Select maintenance vehicle */}
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
              <option
                key={vehicle.vehicle_id}
                value={vehicle.vehicle_id}
              >
                {vehicle.plate_number} — {vehicle.make}{" "}
                {vehicle.model}
              </option>
            );
          })}
        </select>
      </div>

      {/* Start maintenance */}
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

          <label htmlFor="maintenance-odometer">
            Odometer Reading
          </label>

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

          <label htmlFor="maintenance-cost">
            Maintenance Cost (RWF)
          </label>

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
            {maintenanceLoading
              ? "Processing..."
              : "Start Maintenance"}
          </button>
        </form>
      </div>

      {/* Maintenance history */}
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
                      <strong>Odometer:</strong>{" "}
                      {record.odometer_reading}
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
  );
}
