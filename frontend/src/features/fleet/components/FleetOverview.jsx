
export default function FleetOverview({
  availableVehicles,
  vehiclesInuse,
  vehiclesOutofService,
  vehiclesInmaintenance,
}) {
  const statistics = [
    {
      label: "Available Vehicles",
      value: availableVehicles,
    },
    {
      label: "Vehicles In Use",
      value: vehiclesInuse,
    },
    {
      label: "Out of Service",
      value: vehiclesOutofService,
    },
    {
      label: "Under Maintenance",
      value: vehiclesInmaintenance,
    },
  ];

  return (
    <section className="fleet-status-overview">
      {statistics.map(({ label, value }) => (
        <div className="status-card" key={label}>
          <p className="status-label">{label}</p>
          <p className="status-value">{value}</p>
        </div>
      ))}
    </section>
  );
}
