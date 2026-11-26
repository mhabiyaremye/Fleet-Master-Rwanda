import { apiFetch } from "../../services/api.js";
import { useState, useEffect, useCallback } from "react";
import "./fleet-manager.css";
import FleetNavigation from "./components/FleetNavigation.jsx";
import FleetOverview from "./components/FleetOverview.jsx";
import VehicleRegistration from "./vehicles/VehicleRegistration.jsx";
import MaintenancePanel from "./maintenance/MaintenancePanel.jsx";
import FuelPlanningPanel from "./fuel-planning/FuelPlanningPanel.jsx";
import VehicleManagementPanel from "./vehicles/VehicleManagementPanel.jsx";

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
      const response = await apiFetch("/fuel-planning", {
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

      const response = await apiFetch("/fuel-planning", {
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

    apiFetch("/vehicles", {
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

    apiFetch("/vehicles", {
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
    apiFetch("/vehicles/approved-employees", {
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

    apiFetch(`/vehicles/${selectedVehicle.vehicle_id}/assign`, {
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
      const response = await apiFetch(`/vehicles/${vehicle.vehicle_id}/unassign`, {
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
  ...data.vehicle,
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

    apiFetch(`/vehicles/${vehicleId}/maintenance`, {
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

    apiFetch(`/vehicles/${maintenanceVehicleId}/maintenance`, {
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

    apiFetch(
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

    apiFetch(
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
        apiFetch("/vehicles", {
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
          <FleetNavigation
            fleetView={fleetView}
            setFleetView={setFleetView}
          />

          {/* Main dashboard content */}
          <main className="fleet-manager-content">
            {/* =================================================
                OVERVIEW
            ================================================= */}
            {fleetView === "overview" && (
              <FleetOverview
                availableVehicles={availableVehicles}
                vehiclesInuse={vehiclesInuse}
                vehiclesOutofService={vehiclesOutofService}
                vehiclesInmaintenance={vehiclesInmaintenance}
              />
            )}

            {/* =================================================
                VEHICLES
            ================================================= */}
            {fleetView === "vehicles" && (
              <VehicleManagementPanel
                assignmentMessage={assignmentMessage}
                assignmentSuccess={assignmentSuccess}
                availableVehicles={availableVehicles}
                employees={employees}
                filteredVehicles={filteredVehicles}
                getVehicleStatusClass={getVehicleStatusClass}
                getVehicleStatusLabel={getVehicleStatusLabel}
                handleAssignFromDetails={handleAssignFromDetails}
                handleSubmitAssignment={handleSubmitAssignment}
                handleUnassignVehicle={handleUnassignVehicle}
                handleViewVehicle={handleViewVehicle}
                selectedEmployee={selectedEmployee}
                selectedVehicle={selectedVehicle}
                setAssignmentMessage={setAssignmentMessage}
                setAssignmentSuccess={setAssignmentSuccess}
                setSelectedEmployee={setSelectedEmployee}
                setSelectedVehicle={setSelectedVehicle}
                setVehicleDetails={setVehicleDetails}
                setVehicleSearch={setVehicleSearch}
                setVehicleStatusFilter={setVehicleStatusFilter}
                unassignMessage={unassignMessage}
                unassigningVehicleId={unassigningVehicleId}
                vehicleDetails={vehicleDetails}
                vehicleSearch={vehicleSearch}
                vehicleStatusFilter={vehicleStatusFilter}
                vehicles={vehicles}
                vehiclesInmaintenance={vehiclesInmaintenance}
                vehiclesInuse={vehiclesInuse}
                vehiclesOutofService={vehiclesOutofService}
              />
            )}

            {/* =================================================
                ADD VEHICLE
            ================================================= */}
            {fleetView === "add-vehicle" && (
              <VehicleRegistration
                plateNumber={plateNumber}
                setPlateNumber={setPlateNumber}
                make={make}
                setMake={setMake}
                model={model}
                setModel={setModel}
                year={year}
                setYear={setYear}
                currentOdometer={currentOdometer}
                setCurrentOdometer={setCurrentOdometer}
                handleAddVehicle={handleAddVehicle}
                message={message}
              />
            )}

            {/* =================================================
                VEHICLE MAINTENANCE
            ================================================= */}
            {fleetView === "maintenance" && (
              <MaintenancePanel
                vehicles={vehicles}
                maintenanceVehicleId={maintenanceVehicleId}
                setMaintenanceVehicleId={setMaintenanceVehicleId}
                maintenanceRecords={maintenanceRecords}
                setMaintenanceRecords={setMaintenanceRecords}
                maintenanceMessage={maintenanceMessage}
                setMaintenanceMessage={setMaintenanceMessage}
                maintenanceLoading={maintenanceLoading}
                maintenanceType={maintenanceType}
                setMaintenanceType={setMaintenanceType}
                maintenanceDescription={maintenanceDescription}
                setMaintenanceDescription={setMaintenanceDescription}
                maintenanceDate={maintenanceDate}
                setMaintenanceDate={setMaintenanceDate}
                maintenanceOdometer={maintenanceOdometer}
                setMaintenanceOdometer={setMaintenanceOdometer}
                maintenanceCost={maintenanceCost}
                setMaintenanceCost={setMaintenanceCost}
                handleLoadMaintenanceHistory={handleLoadMaintenanceHistory}
                handleStartMaintenance={handleStartMaintenance}
                handleCompleteMaintenance={handleCompleteMaintenance}
                handleConfirmVehicleReady={handleConfirmVehicleReady}
              />
            )}

            {/* =================================================
                FUEL PLANNING
            ================================================= */}
            {fleetView === "fuel-planning" && (
              <FuelPlanningPanel
                fuelBudgetMonth={fuelBudgetMonth}
                fuelBudgetSummary={fuelBudgetSummary}
                fuelDraftsLoading={fuelDraftsLoading}
                fuelDraftsMessage={fuelDraftsMessage}
                fuelEnergyTypes={fuelEnergyTypes}
                fuelEntries={fuelEntries}
                fuelIncluded={fuelIncluded}
                fuelJustification={fuelJustification}
                fuelMessage={fuelMessage}
                fuelSaving={fuelSaving}
                handleFuelEntryChange={handleFuelEntryChange}
                handleSaveFuelDraft={handleSaveFuelDraft}
                handleSelectFuelDraft={handleSelectFuelDraft}
                loadFuelDrafts={loadFuelDrafts}
                savedFuelDrafts={savedFuelDrafts}
                selectedFuelDraft={selectedFuelDraft}
                setFuelBudgetMonth={setFuelBudgetMonth}
                setFuelEnergyTypes={setFuelEnergyTypes}
                setFuelIncluded={setFuelIncluded}
                setFuelJustification={setFuelJustification}
                setFuelMessage={setFuelMessage}
                setSelectedFuelDraft={setSelectedFuelDraft}
                vehicles={vehicles}
              />
            )}
          </main>
        </div>
      </div>
    </>
  );
}

export default FleetManager;
