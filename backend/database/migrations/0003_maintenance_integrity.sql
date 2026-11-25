-- Migration 0003: Maintenance integrity
--
-- Protect maintenance lifecycle invariants
-- and improve maintenance history retrieval.

-- 1. Prevent multiple active maintenance
-- records for the same vehicle.

CREATE UNIQUE INDEX idx_one_active_maintenance_per_vehicle
ON public.maintenance_records (vehicle_id)
WHERE status = 'in progress';

-- 2. Support efficient vehicle maintenance
-- history retrieval.

CREATE INDEX idx_maintenance_vehicle_history
ON public.maintenance_records (
    vehicle_id,
    maintenance_date DESC,
    maintenance_id DESC
);

-- 3. Prevent negative vehicle odometer values.

ALTER TABLE public.vehicles
ADD CONSTRAINT chk_vehicle_current_odometer_nonnegative
CHECK (current_odometer >= 0);
