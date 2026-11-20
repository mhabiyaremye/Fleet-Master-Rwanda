import { useState, useEffect, useCallback } from "react";
import "./fleet-manager.css";

function FleetManager() {
  // Vehicle form state
  const [plateNumber, setPlateNumber] = useState("");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [currentOdometer, setCurrentOdometer] = useState("");

  // Vehicle records and dashboard navigation
  const [vehicles, setVehicles] = useState([]);
  const [fleetView, setFleetView] = useState("overview");
  const [message, setMessage] = useState("");
  const [vehicleLoadMessage, setVehicleLoadMessage] = useState(function () {
    return sessionStorage.getItem("token")
      ? ""
      : "Your session has expired. Please log in again.";
  });
  // Vehicle search and filtering
  const [vehicleSearch, setVehicleSearch] = useState("");
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState("all");

  // Vehicle assignment state
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [assignmentSuccess, setAssignmentSuccess] = useState(false);
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [unassigningVehicleId, setUnassigningVehicleId] = useState(null);
  const [unassignMessage, setUnassignMessage] = useState("");

  // Vehicle details dialog state
  const [vehicleDetails, setVehicleDetails] = useState(null);

  // Maintenance state
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
  const [fuelSaving, setFuelSaving] = useState(false);

  // Saved fuel budget drafts
  const [savedFuelDrafts, setSavedFuelDrafts] = useState([]);
  const [fuelDraftsLoading, setFuelDraftsLoading] = useState(false);
  const [fuelDraftsMessage, setFuelDraftsMessage] = useState("");
  const [selectedFuelDraft, setSelectedFuelDraft] = useState(null);

  // =========================================================
  // FUEL PLANNING FUNCTIONS
  // =========================================================

  function getFuelVehicleSettings(vehicle) {
    const vehicleId = vehicle.vehicle_id;

    return {
      entry: fuelEntries[vehicleId] || {},
      energyType: fuelEnergyTypes[vehicleId] || "diesel",
      isIncluded:
        fuelIncluded[vehicleId] ??
        (vehicle.status !== "out of service" &&
          vehicle.status !== "maintenance"),
    };
  }

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

  async function handleSaveFuelDraft() {
    setFuelMessage("");

    if (!fuelBudgetMonth || !fuelJustification.trim()) {
      setFuelMessage(
        "Please select a budget month and provide an operational justification.",
      );
      return;
    }

    if (vehicles.length === 0) {
      setFuelMessage("Add vehicles before saving a fuel budget.");
      return;
    }

    const token = sessionStorage.getItem("token");

    if (!token) {
      setFuelMessage("Your session has expired. Please log in again.");
      return;
    }

    const items = vehicles.map(function (vehicle) {
      const vehicleId = vehicle.vehicle_id;
      const { entry, energyType, isIncluded } = getFuelVehicleSettings(vehicle);

      const usesElectricity =
        energyType === "electric" || energyType === "hybrid";

      const usesFuel =
        energyType === "petrol" ||
        energyType === "diesel" ||
        energyType === "hybrid";

      return {
        vehicle_id: vehicleId,
        energy_type: energyType,
        requested_litres: usesFuel ? Number(entry.requestedLitres || 0) : 0,
        price_per_litre: usesFuel ? Number(entry.pricePerLitre || 0) : 0,
        requested_kwh: usesElectricity ? Number(entry.requestedKwh || 0) : 0,
        price_per_kwh: usesElectricity ? Number(entry.pricePerKwh || 0) : 0,
        is_included: isIncluded,
      };
    });

    setFuelSaving(true);

    try {
      const response = await fetch("/fuel-planning", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          budget_month: fuelBudgetMonth,
          justification: fuelJustification.trim(),
          items: items,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        setFuelMessage(data.message || "Failed to save the fuel budget draft.");
        return;
      }

      setFuelMessage(
        `Fuel budget draft saved successfully. Proposal ID: ${data.proposal.proposal_id}`,
      );
      await loadFuelDrafts();
    } catch (error) {
      console.error("Failed to save fuel budget draft:", error);

      setFuelMessage(
        "Could not reach the server. Check that the backend is running and try again.",
      );
    } finally {
      setFuelSaving(false);
    }
  }

  const loadFuelDrafts = useCallback(async function () {
    setFuelDraftsLoading(true);
    setFuelDraftsMessage("");

    try {
      const token = sessionStorage.getItem("token");

      if (!token) {
        setFuelDraftsMessage("Please log in to view saved fuel drafts.");
        return;
      }

      const response = await fetch("/fuel-planning", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to load saved fuel budget drafts.",
        );
      }

      setSavedFuelDrafts(Array.isArray(data.proposals) ? data.proposals : []);
    } catch (error) {
      console.error("Failed to load fuel budget drafts:", error);
      setFuelDraftsMessage(error.message);
    } finally {
      setFuelDraftsLoading(false);
    }
  }, []);

  function handleSelectFuelDraft(draft) {
    setSelectedFuelDraft(draft);
  }

  // =========================================================
  // FUEL BUDGET SUMMARY
  // =========================================================

  const fuelBudgetSummary = vehicles.reduce(
    function (summary, vehicle) {
      const { entry, energyType, isIncluded } = getFuelVehicleSettings(vehicle);

      if (!isIncluded) {
        return summary;
      }

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

        totalFuelLitres:
          summary.totalFuelLitres + petrolLitres + dieselLitres + hybridLitres,

        totalElectricityKwh:
          summary.totalElectricityKwh + electricKwh + hybridKwh,

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
      totalFuelLitres: 0,
      totalElectricityKwh: 0,

      petrolCost: 0,
      dieselCost: 0,
      electricCost: 0,
      hybridFuelCost: 0,
      hybridElectricCost: 0,

      totalCost: 0,
    },
  );

  // =========================================================
  // INITIAL DATA LOADING
  // =========================================================

  useEffect(function () {
    const token = sessionStorage.getItem("token");

    if (!token) {
      return;
    }

    fetch("/vehicles", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setVehicleLoadMessage(
            data.message || "Unable to load vehicles. Please try again.",
          );
          return;
        }

        setVehicleLoadMessage("");
        setVehicles(data.vehicles);
      })
      .catch(function (error) {
        console.error("Failed to load vehicles:", error);
        setVehicleLoadMessage("Unable to load vehicles. Please try again.");
      });
  }, []);
  // Automatically dismiss successful unassignment messages
  useEffect(() => {
    if (unassignMessage !== "Driver unassigned successfully.") {
      return;
    }

    const timer = setTimeout(() => {
      setUnassignMessage("");
    }, 4000);

    return () => clearTimeout(timer);
  }, [unassignMessage]);

  useEffect(
    function () {
      if (fleetView === "fuel-planning") {
        loadFuelDrafts();
      }
    },
    [fleetView, loadFuelDrafts],
  );

  // =========================================================
  // VEHICLE STATUS COUNTS
  // =========================================================

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
  // =========================================================
  // VEHICLE SEARCH AND FILTERING
  // =========================================================

  const filteredVehicles = vehicles.filter(function (vehicle) {
    const searchTerm = vehicleSearch.trim().toLowerCase();

    const vehicleInformation = [
      vehicle.plate_number,
      vehicle.make,
      vehicle.model,
      vehicle.year,
      vehicle.firstname,
      vehicle.lastname,
      vehicle.driver_name,
      vehicle.assigned_driver_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      searchTerm === "" || vehicleInformation.includes(searchTerm);

    const matchesStatus =
      vehicleStatusFilter === "all" || vehicle.status === vehicleStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Normalize status for CSS styling.
  function getVehicleStatusClass(status) {
    return String(status || "")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  // Display readable vehicle status.
  function getVehicleStatusLabel(status) {
    const statusLabels = {
      available: "Available",
      "in use": "In Use",
      "out of service": "Out of Service",
      maintenance: "Maintenance",
    };

    return statusLabels[status] || status || "Unknown";
  }

  // =========================================================
  // VEHICLE CREATION
  // =========================================================

  function handleAddVehicle(event) {
    setMessage("");
    event.preventDefault();

    const token = sessionStorage.getItem("token");

    if (!token) {
      setMessage("Your session has expired. Please log in again.");
      return;
    }

    fetch("/vehicles", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
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

  // =========================================================
  // VEHICLE DETAILS AND ASSIGNMENT
  // =========================================================

  function handleViewVehicle(vehicle) {
    setUnassignMessage("");
    setVehicleDetails(vehicle);
  }

  function handleAssignFromDetails() {
    if (!vehicleDetails) {
      return;
    }

    const vehicleToAssign = vehicleDetails;

    // Close vehicle details before opening assignment.
    setVehicleDetails(null);

    // Reuse the existing assignment workflow.
    handleAssignVehicle(vehicleToAssign);
  }

  function handleAssignVehicle(vehicle) {
    // Reset the previous assignment state.
    setAssignmentSuccess(false);
    setAssignmentMessage("");
    setSelectedEmployee("");

    // Select the vehicle for assignment.
    setSelectedVehicle(vehicle);

    const token = sessionStorage.getItem("token");

    if (!token) {
      setAssignmentMessage("Your session has expired. Please log in again.");
      return;
    }

    // Load employees who are approved for assignment.
    fetch("/vehicles/approved-employees", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setAssignmentMessage(
            data.message || "Unable to load approved employees.",
          );
          return;
        }

        setEmployees(data.employees);
      })
      .catch(function (error) {
        console.log(error);
        setAssignmentMessage("Unable to load employees. Please try again.");
      });
  }

  function handleSubmitAssignment() {
    if (!selectedVehicle || !selectedEmployee) {
      setAssignmentMessage("Please select an employee.");
      return;
    }

    const token = sessionStorage.getItem("token");

    if (!token) {
      setAssignmentMessage("Your session has expired. Please log in again.");
      return;
    }

    fetch(`/vehicles/${selectedVehicle.vehicle_id}/assign`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        employee_id: selectedEmployee,
      }),
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        console.log(data);

        if (data.success === false) {
          setAssignmentSuccess(false);
          setAssignmentMessage(data.message);
          return;
        }

        const assignedVehicle = data.vehicle;

        setAssignmentSuccess(true);
        setAssignmentMessage("");

        // Update the vehicle record in React state.
        setVehicles(function (currentVehicles) {
          return currentVehicles.map(function (currentVehicle) {
            if (currentVehicle.vehicle_id === assignedVehicle.vehicle_id) {
              return assignedVehicle;
            }

            return currentVehicle;
          });
        });
      })
      .catch(function (error) {
        console.log(error);
        setAssignmentMessage("Unable to connect to the server.");
      });
  }

  async function handleUnassignVehicle(vehicle) {
    if (unassigningVehicleId !== null) return;

    setUnassignMessage("");

    const token = sessionStorage.getItem("token");

    if (!token) {
      setUnassignMessage("Session expired. Please log in again.");
      return;
    }

    setUnassigningVehicleId(vehicle.vehicle_id);

    try {
      const response = await fetch(`/vehicles/${vehicle.vehicle_id}/unassign`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || data.success === false) {
        setUnassignMessage(data.message || "Unable to unassign vehicle.");
        return;
      }

      const updatedVehicle = {
        ...vehicle,
        ...(data.vehicle || {}),
        assigned_driver_id: null,
        status: "available",
        firstname: null,
        lastname: null,
      };

      setVehicles(function (currentVehicles) {
        return currentVehicles.map(function (currentVehicle) {
          return currentVehicle.vehicle_id === vehicle.vehicle_id
            ? updatedVehicle
            : currentVehicle;
        });
      });

      setVehicleDetails(updatedVehicle);
      setUnassignMessage("Driver unassigned successfully.");
    } catch (error) {
      console.error("Vehicle unassignment failed:", error);
      setUnassignMessage("Unable to connect to the backend.");
    } finally {
      setUnassigningVehicleId(null);
    }
  }

  // =========================================================
  // MAINTENANCE FUNCTIONS
  // =========================================================

  function handleLoadMaintenanceHistory(vehicleId) {
    setMaintenanceVehicleId(vehicleId);
    setMaintenanceRecords([]);
    setMaintenanceMessage("");
    setMaintenanceLoading(true);

    const token = sessionStorage.getItem("token");

    fetch(`/vehicles/${vehicleId}/maintenance`, {
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

    fetch(`/vehicles/${maintenanceVehicleId}/maintenance`, {
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
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data.success) {
          setMaintenanceMessage(data.message || "Failed to start maintenance.");
          setMaintenanceLoading(false);
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
        setMaintenanceLoading(false);
      });
  }

  function handleCompleteMaintenance(record) {
    setMaintenanceMessage("");

    const token = sessionStorage.getItem("token");

    fetch(
      `/vehicles/${maintenanceVehicleId}/maintenance/${record.maintenance_id}`,
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
      `/vehicles/${maintenanceVehicleId}/maintenance/${record.maintenance_id}/confirm-ready`,
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
        fetch("/vehicles", {
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

  // =========================================================
  // DASHBOARD RENDERING
  // =========================================================

  return (
    <>
      <div className="fleet-manager-dashboard">
        <header className="fleet-manager-page-heading">
          <h1 className="fleet-manager-brand">FMR</h1>
          <p className="fleet-manager-page-title">Fleet Manager Dashboard</p>
        </header>

        {vehicleLoadMessage && (
          <p className="maintenance-message" role="alert">
            {vehicleLoadMessage}
          </p>
        )}

        {/* Responsive dashboard layout */}
        <div className="fleet-manager-layout">
          {/* Dashboard navigation */}
          <nav
            className="fleet-manager-nav"
            aria-label="Fleet manager navigation"
          >
            <button
              type="button"
              className={fleetView === "overview" ? "active" : ""}
              onClick={() => setFleetView("overview")}
            >
              Overview
            </button>

            <button
              type="button"
              className={fleetView === "vehicles" ? "active" : ""}
              onClick={() => setFleetView("vehicles")}
            >
              Vehicles
            </button>

            <button
              type="button"
              className={fleetView === "add-vehicle" ? "active" : ""}
              onClick={() => setFleetView("add-vehicle")}
            >
              Add Vehicle
            </button>

            <button
              type="button"
              className={fleetView === "maintenance" ? "active" : ""}
              onClick={() => setFleetView("maintenance")}
            >
              Maintenance
            </button>

            <button
              type="button"
              className={fleetView === "fuel-planning" ? "active" : ""}
              onClick={() => setFleetView("fuel-planning")}
            >
              Fuel Planning
            </button>
          </nav>

          {/* Main dashboard content */}
          <main className="fleet-manager-content">
            {/* =================================================
                OVERVIEW
            ================================================= */}
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

            {/* =================================================
                VEHICLES
            ================================================= */}
            {fleetView === "vehicles" && (
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
            )}

            {/* =================================================
                ADD VEHICLE
            ================================================= */}
            {fleetView === "add-vehicle" && (
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
            )}

            {/* =================================================
                VEHICLE MAINTENANCE
            ================================================= */}
            {fleetView === "maintenance" && (
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
            )}

            {/* =================================================
                FUEL PLANNING
            ================================================= */}
            {fleetView === "fuel-planning" && (
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
            )}
          </main>
        </div>
      </div>
    </>
  );
}

export default FleetManager;
