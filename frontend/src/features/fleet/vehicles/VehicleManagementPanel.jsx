export default function VehicleManagementPanel({
  assignmentMessage,
  assignmentSuccess,
  availableVehicles,
  employees,
  filteredVehicles,
  getVehicleStatusClass,
  getVehicleStatusLabel,
  handleAssignFromDetails,
  handleSubmitAssignment,
  handleUnassignVehicle,
  handleViewVehicle,
  selectedEmployee,
  selectedVehicle,
  setAssignmentMessage,
  setAssignmentSuccess,
  setSelectedEmployee,
  setSelectedVehicle,
  setVehicleDetails,
  setVehicleSearch,
  setVehicleStatusFilter,
  unassignMessage,
  unassigningVehicleId,
  vehicleDetails,
  vehicleSearch,
  vehicleStatusFilter,
  vehicles,
  vehiclesInmaintenance,
  vehiclesInuse,
  vehiclesOutofService,
}) {
  return (
    <section className="vehicle-list" aria-label="Fleet vehicles">
      {/* VEHICLE SEARCH AND STATUS FILTERS */}
      <div className="vehicle-list-toolbar">
        <div className="vehicle-search-wrapper">
          <input
            type="search"
            className="vehicle-search-input"
            placeholder="Search by plate number, make, model or driver..."
            value={vehicleSearch}
            onChange={function (event) {
              setVehicleSearch(event.target.value);
            }}
            aria-label="Search vehicles"
          />

          {vehicleSearch && (
            <button
              type="button"
              className="vehicle-search-clear"
              onClick={function () {
                setVehicleSearch("");
              }}
              aria-label="Clear vehicle search"
            >
              Clear
            </button>
          )}
        </div>

        <div className="vehicle-status-filters">
          <button
            type="button"
            className={
              vehicleStatusFilter === "all"
                ? "vehicle-filter-button active"
                : "vehicle-filter-button"
            }
            aria-pressed={vehicleStatusFilter === "all"}
            onClick={function () {
              setVehicleStatusFilter("all");
            }}
          >
            All ({vehicles.length})
          </button>

          <button
            type="button"
            className={
              vehicleStatusFilter === "available"
                ? "vehicle-filter-button active"
                : "vehicle-filter-button"
            }
            aria-pressed={vehicleStatusFilter === "available"}
            onClick={function () {
              setVehicleStatusFilter("available");
            }}
          >
            Available ({availableVehicles})
          </button>

          <button
            type="button"
            className={
              vehicleStatusFilter === "in use"
                ? "vehicle-filter-button active"
                : "vehicle-filter-button"
            }
            aria-pressed={vehicleStatusFilter === "in use"}
            onClick={function () {
              setVehicleStatusFilter("in use");
            }}
          >
            In Use ({vehiclesInuse})
          </button>

          <button
            type="button"
            className={
              vehicleStatusFilter === "maintenance"
                ? "vehicle-filter-button active"
                : "vehicle-filter-button"
            }
            aria-pressed={vehicleStatusFilter === "maintenance"}
            onClick={function () {
              setVehicleStatusFilter("maintenance");
            }}
          >
            Maintenance ({vehiclesInmaintenance})
          </button>

          <button
            type="button"
            className={
              vehicleStatusFilter === "out of service"
                ? "vehicle-filter-button active"
                : "vehicle-filter-button"
            }
            aria-pressed={vehicleStatusFilter === "out of service"}
            onClick={function () {
              setVehicleStatusFilter("out of service");
            }}
          >
            Out of Service ({vehiclesOutofService})
          </button>
        </div>

        <p className="vehicle-search-results">
          Showing {filteredVehicles.length} of {vehicles.length}{" "}
          vehicles
        </p>
      </div>
      {/* Keep the list concise; full vehicle information lives in View Details. */}
      <div className="vehicle-header" aria-hidden="true">
        <p>Vehicle</p>
        <p>Details</p>
      </div>

      <div className="vehicle-records" role="list">
        {filteredVehicles.map(function (vehicle) {
          return (
            <div
              className="vehicle-row"
              role="listitem"
              key={vehicle.vehicle_id}
            >
              <div className="vehicle-identity">
                <strong>{vehicle.plate_number}</strong>

                <span
                  className={`vehicle-status-badge status-${getVehicleStatusClass(
                    vehicle.status,
                  )}`}
                >
                  {getVehicleStatusLabel(vehicle.status)}
                </span>
              </div>

              <p className="vehicle-details-trigger">
                <button
                  type="button"
                  onClick={function () {
                    handleViewVehicle(vehicle);
                  }}
                  aria-label={`View details for ${vehicle.plate_number}`}
                >
                  View Details
                </button>
              </p>
            </div>
          );
        })}
      </div>
      {filteredVehicles.length === 0 && (
        <div className="vehicle-empty-state">
          <h3>No vehicles found</h3>

          <p>
            {vehicleSearch
              ? "Try another search term or clear your search."
              : "There are no vehicles matching the selected status."}
          </p>

          <button
            type="button"
            onClick={function () {
              setVehicleSearch("");
              setVehicleStatusFilter("all");
            }}
          >
            Clear Search and Filters
          </button>
        </div>
      )}

      {/* VEHICLE DETAILS DIALOG */}
      {vehicleDetails && (
        <div className="vehicle-details-modal-overlay">
          <section
            className="vehicle-details-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vehicle-details-title"
          >
            <div className="vehicle-details-header">
              <div>
                <h2 id="vehicle-details-title">Vehicle Details</h2>

                <p>
                  Complete information for{" "}
                  {vehicleDetails.plate_number}
                </p>
              </div>

              <button
                type="button"
                className="vehicle-details-close"
                aria-label="Close vehicle details"
                onClick={function () {
                  setVehicleDetails(null);
                }}
              >
                Close
              </button>
            </div>

            {/* Vehicle information */}
            <div className="vehicle-details-grid">
              <div className="vehicle-details-item">
                <span>Plate Number</span>
                <strong>{vehicleDetails.plate_number}</strong>
              </div>

              <div className="vehicle-details-item">
                <span>Make</span>
                <strong>{vehicleDetails.make}</strong>
              </div>

              <div className="vehicle-details-item">
                <span>Model</span>
                <strong>{vehicleDetails.model}</strong>
              </div>

              <div className="vehicle-details-item">
                <span>Year</span>
                <strong>{vehicleDetails.year}</strong>
              </div>

              <div className="vehicle-details-item">
                <span>Odometer</span>
                <strong>{vehicleDetails.current_odometer}</strong>
              </div>

              <div className="vehicle-details-item">
                <span>Status</span>
                <strong>{vehicleDetails.status}</strong>
              </div>

              <div className="vehicle-details-item">
                <span>Assigned Driver</span>
                <strong>
                  {vehicleDetails.assigned_driver_id
                    ? `${vehicleDetails.firstname} ${vehicleDetails.lastname}`
                    : "Unassigned"}
                </strong>
              </div>
            </div>

            {/* Vehicle management actions */}
            <div className="vehicle-details-actions">
              {!vehicleDetails.assigned_driver_id &&
                vehicleDetails.status === "available" && (
                  <button
                    type="button"
                    onClick={handleAssignFromDetails}
                  >
                    Assign Driver
                  </button>
                )}
              {vehicleDetails.assigned_driver_id &&
                vehicleDetails.status === "in use" && (
                  <button
                    type="button"
                    disabled={unassigningVehicleId !== null}
                    onClick={() =>
                      handleUnassignVehicle(vehicleDetails)
                    }
                  >
                    {unassigningVehicleId ===
                    vehicleDetails.vehicle_id
                      ? "Unassigning..."
                      : "Unassign Driver"}
                  </button>
                )}
              {unassignMessage && (
                <p className="message" role="status">
                  {unassignMessage}
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {/* DRIVER ASSIGNMENT MODAL */}
      {selectedVehicle && (
        <div className="assignment-modal-overlay">
          <section
            className="assignment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="assignment-modal-title"
          >
            {!assignmentSuccess ? (
              <>
                <h2 id="assignment-modal-title">Assign Vehicle</h2>

                <p>Vehicle: {selectedVehicle.plate_number}</p>

                <label
                  className="assignment-select-label"
                  htmlFor="assignment-employee"
                >
                  Select an approved employee
                </label>
                <select
                  id="assignment-employee"
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

                <button
                  type="button"
                  onClick={handleSubmitAssignment}
                >
                  Assign
                </button>

                <button
                  type="button"
                  onClick={function () {
                    setSelectedVehicle(null);
                    setSelectedEmployee("");
                    setAssignmentMessage("");
                    setAssignmentSuccess(false);
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <div className="assignment-success">
                <h2 id="assignment-modal-title">
                  Vehicle Assigned Successfully
                </h2>

                <p>The vehicle has been assigned successfully.</p>

                <button
                  type="button"
                  onClick={function () {
                    setAssignmentSuccess(false);
                    setSelectedVehicle(null);
                    setSelectedEmployee("");
                    setAssignmentMessage("");
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
