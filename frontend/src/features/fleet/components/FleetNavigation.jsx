
const navigationItems = [
  { id: "overview", label: "Overview" },
  { id: "vehicles", label: "Vehicles" },
  { id: "add-vehicle", label: "Add Vehicle" },
  { id: "maintenance", label: "Maintenance" },
  { id: "fuel-planning", label: "Fuel Planning" },
];

export default function FleetNavigation({
  fleetView,
  setFleetView,
}) {
  return (
    <nav
      className="fleet-manager-nav"
      aria-label="Fleet manager navigation"
    >
      {navigationItems.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={fleetView === id ? "active" : ""}
          onClick={() => setFleetView(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
