export default function VehicleRegistration({
  plateNumber,
  setPlateNumber,
  make,
  setMake,
  model,
  setModel,
  year,
  setYear,
  currentOdometer,
  setCurrentOdometer,
  handleAddVehicle,
  message,
}) {
  return (
    <section>
      <form className="add-vehicle-form" onSubmit={handleAddVehicle}>
        <div className="form-field">
          <label htmlFor="plate-number">Plate Number</label>
          <input
            id="plate-number"
            type="text"
            placeholder="Plate Number"
            value={plateNumber}
            onChange={function (event) {
              setPlateNumber(event.target.value);
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="vehicle-make">Make</label>
          <input
            id="vehicle-make"
            type="text"
            placeholder="Make"
            value={make}
            onChange={function (event) {
              setMake(event.target.value);
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="vehicle-model">Model</label>
          <input
            id="vehicle-model"
            type="text"
            placeholder="Model"
            value={model}
            onChange={function (event) {
              setModel(event.target.value);
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="vehicle-year">Year</label>
          <input
            id="vehicle-year"
            type="number"
            placeholder="Year"
            value={year}
            onChange={function (event) {
              setYear(event.target.value);
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="current-odometer">Current Odometer</label>
          <input
            id="current-odometer"
            type="number"
            placeholder="Current Odometer"
            value={currentOdometer}
            onChange={function (event) {
              setCurrentOdometer(event.target.value);
            }}
          />
        </div>

        <button type="submit">Add Vehicle</button>

        {message && <p className="message">{message}</p>}
      </form>
    </section>
  );
}
