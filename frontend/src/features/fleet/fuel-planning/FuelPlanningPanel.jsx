export default function FuelPlanningPanel({
  fuelBudgetMonth,
  fuelBudgetSummary,
  fuelDraftsLoading,
  fuelDraftsMessage,
  fuelEnergyTypes,
  fuelEntries,
  fuelIncluded,
  fuelJustification,
  fuelMessage,
  fuelSaving,
  handleFuelEntryChange,
  handleSaveFuelDraft,
  handleSelectFuelDraft,
  loadFuelDrafts,
  savedFuelDrafts,
  selectedFuelDraft,
  setFuelBudgetMonth,
  setFuelEnergyTypes,
  setFuelIncluded,
  setFuelJustification,
  setFuelMessage,
  setSelectedFuelDraft,
  vehicles,
}) {
  return (
    <section className="fuel-planning-section">
      <div className="fuel-planning-header">
        <h2>Monthly Fuel Planning</h2>

        <p>
          Prepare and review your fleet's monthly fuel requirements
          before submitting a proposal to Finance.
        </p>
      </div>

      {/* Fuel planning form */}
      <div className="fuel-planning-form">
        <div className="fuel-form-group">
          <label htmlFor="fuel-budget-month">Budget Month</label>

          <input
            id="fuel-budget-month"
            type="month"
            value={fuelBudgetMonth}
            onChange={(event) =>
              setFuelBudgetMonth(event.target.value)
            }
          />
        </div>

        <div className="fuel-form-group">
          <label htmlFor="fuel-justification">
            Operational Justification
          </label>

          <textarea
            id="fuel-justification"
            value={fuelJustification}
            onChange={(event) =>
              setFuelJustification(event.target.value)
            }
            placeholder="Explain the operational needs behind this month's fuel request..."
            rows={4}
          />
        </div>
      </div>

      {/* Fuel budget summary */}
      <div className="fuel-budget-summary">
        <div className="fuel-summary-card">
          <span>Vehicles Included</span>
          <strong>{fuelBudgetSummary.vehicleCount}</strong>
        </div>

        <div className="fuel-summary-card">
          <span>Total Fuel Required</span>

          <strong>
            {fuelBudgetSummary.totalFuelLitres.toLocaleString(
              "en-RW",
            )}{" "}
            L
          </strong>

          <small>Petrol, diesel, and hybrid fuel combined</small>
        </div>

        <div className="fuel-summary-card">
          <span>Total Electricity Required</span>

          <strong>
            {fuelBudgetSummary.totalElectricityKwh.toLocaleString(
              "en-RW",
            )}{" "}
            kWh
          </strong>

          <small>Electric and hybrid electricity combined</small>
        </div>

        {fuelBudgetSummary.petrolLitres > 0 && (
          <div className="fuel-summary-card">
            <span>Petrol Budget</span>

            <strong>
              {fuelBudgetSummary.petrolCost.toLocaleString("en-RW")}{" "}
              RWF
            </strong>

            <small>
              {fuelBudgetSummary.petrolLitres.toLocaleString("en-RW")}{" "}
              L required
            </small>
          </div>
        )}

        {fuelBudgetSummary.dieselLitres > 0 && (
          <div className="fuel-summary-card">
            <span>Diesel Budget</span>

            <strong>
              {fuelBudgetSummary.dieselCost.toLocaleString("en-RW")}{" "}
              RWF
            </strong>

            <small>
              {fuelBudgetSummary.dieselLitres.toLocaleString("en-RW")}{" "}
              L required
            </small>
          </div>
        )}

        {fuelBudgetSummary.electricKwh > 0 && (
          <div className="fuel-summary-card">
            <span>Electricity Budget</span>

            <strong>
              {fuelBudgetSummary.electricCost.toLocaleString("en-RW")}{" "}
              RWF
            </strong>

            <small>
              {fuelBudgetSummary.electricKwh.toLocaleString("en-RW")}{" "}
              kWh required
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
              {fuelBudgetSummary.hybridLitres.toLocaleString("en-RW")}{" "}
              L fuel
              {" · "}
              {fuelBudgetSummary.hybridKwh.toLocaleString(
                "en-RW",
              )}{" "}
              kWh electricity
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

      {/* Vehicle fuel requirements */}
      <div className="fuel-vehicle-requirements">
        <h3>Vehicle Fuel Requirements</h3>

        <p>
          Select the vehicles to include and enter the estimated
          monthly fuel requirements for each.
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
              <div
                className="fuel-vehicle-card"
                key={vehicle.vehicle_id}
              >
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
                  <label
                    htmlFor={`energy-type-${vehicle.vehicle_id}`}
                  >
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
                        <label
                          htmlFor={`fuel-kwh-${vehicle.vehicle_id}`}
                        >
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

      {/* Save fuel budget draft */}
      <button
        type="button"
        className="save-fuel-draft-button"
        onClick={handleSaveFuelDraft}
        disabled={fuelSaving}
      >
        {fuelSaving ? "Saving Draft..." : "Save Fuel Budget Draft"}
      </button>

      {fuelMessage && (
        <p className="fuel-planning-message" role="status">
          {fuelMessage}
        </p>
      )}

      <p className="fuel-planning-note">
        Saving stores your draft on the server. It does not submit the
        proposal to Finance.
      </p>

      {/* Saved fuel budget drafts */}
      <section className="saved-fuel-drafts">
        <div className="saved-fuel-drafts-header">
          <div>
            <h3>Saved Fuel Budget Drafts</h3>
            <p>Review previously saved monthly fuel proposals.</p>
          </div>

          <button
            type="button"
            onClick={loadFuelDrafts}
            disabled={fuelDraftsLoading}
          >
            {fuelDraftsLoading ? "Loading..." : "Refresh Drafts"}
          </button>
        </div>

        {fuelDraftsMessage && <p role="alert">{fuelDraftsMessage}</p>}

        {!fuelDraftsLoading && savedFuelDrafts.length === 0 && (
          <p>No saved fuel budget drafts found.</p>
        )}

        {savedFuelDrafts.map(function (draft) {
          const draftItems = Array.isArray(draft.items)
            ? draft.items
            : [];
          const totalCost = draftItems.reduce(function (total, item) {
            return total + Number(item.estimated_cost || 0);
          }, 0);

          return (
            <article
              key={draft.proposal_id}
              className="saved-fuel-draft-card"
            >
              <div>
                <h4>Proposal #{draft.proposal_id}</h4>

                <p>
                  Budget month:{" "}
                  {String(draft.budget_month).slice(0, 7)}
                </p>

                <p>Status: {draft.status}</p>

                <p>Vehicles: {draftItems.length}</p>

                <p>
                  Estimated total: {totalCost.toLocaleString("en-RW")}{" "}
                  RWF
                </p>
              </div>

              <button
                type="button"
                onClick={function () {
                  handleSelectFuelDraft(draft);
                }}
              >
                Review Draft
              </button>
            </article>
          );
        })}

        {/* Selected fuel draft details */}
        {selectedFuelDraft && (
          <div className="selected-fuel-draft">
            <h3>Proposal #{selectedFuelDraft.proposal_id} Details</h3>

            <p>
              <strong>Justification:</strong>{" "}
              {selectedFuelDraft.justification}
            </p>

            <p>
              <strong>Status:</strong> {selectedFuelDraft.status}
            </p>

            <div className="saved-fuel-items">
              {(Array.isArray(selectedFuelDraft.items)
                ? selectedFuelDraft.items
                : []
              ).map(function (item) {
                return (
                  <article
                    key={item.vehicle_id}
                    className="saved-fuel-item"
                  >
                    <h4>
                      {item.plate_number} — {item.make} {item.model}
                    </h4>

                    <p>Energy type: {item.energy_type}</p>

                    <p>Included: {item.is_included ? "Yes" : "No"}</p>

                    <p>
                      Fuel: {item.requested_litres} litres ×{" "}
                      {Number(item.price_per_litre).toLocaleString(
                        "en-RW",
                      )}{" "}
                      RWF
                    </p>

                    <p>
                      Electricity: {item.requested_kwh} kWh ×{" "}
                      {Number(item.price_per_kwh).toLocaleString(
                        "en-RW",
                      )}{" "}
                      RWF
                    </p>

                    <p>
                      Estimated cost:{" "}
                      {Number(item.estimated_cost).toLocaleString(
                        "en-RW",
                      )}{" "}
                      RWF
                    </p>
                  </article>
                );
              })}
            </div>

            <button
              type="button"
              onClick={function () {
                setSelectedFuelDraft(null);
              }}
            >
              Close Details
            </button>
          </div>
        )}
      </section>
    </section>
  );
}
