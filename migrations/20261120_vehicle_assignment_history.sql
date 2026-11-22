CREATE TABLE IF NOT EXISTS public.vehicle_assignment_history (
    assignment_id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

    vehicle_id INTEGER NOT NULL
        REFERENCES public.vehicles(vehicle_id),

    driver_employee_id INTEGER NOT NULL
        REFERENCES public.users(employee_id),

    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    first_recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    unassigned_at TIMESTAMPTZ,

    unassignment_reason VARCHAR(100),

    CONSTRAINT valid_assignment_period
        CHECK (
            unassigned_at IS NULL
            OR assigned_at IS NULL
            OR unassigned_at >= assigned_at
        )
);

-- Prevent multiple active assignments for the same vehicle.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_assignment_per_vehicle
ON public.vehicle_assignment_history(vehicle_id)
WHERE unassigned_at IS NULL;

-- Prevent one driver having multiple active assignments.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_assignment_per_driver
ON public.vehicle_assignment_history(driver_employee_id)
WHERE unassigned_at IS NULL;

-- Improve vehicle history retrieval.
CREATE INDEX IF NOT EXISTS idx_vehicle_assignment_history
ON public.vehicle_assignment_history(vehicle_id, assigned_at DESC);
-- Record assignments that existed before history tracking.
INSERT INTO public.vehicle_assignment_history (
    vehicle_id,
    driver_employee_id,
    assigned_at
)
SELECT
    v.vehicle_id,
    v.assigned_driver_id,
    NULL
FROM public.vehicles v
WHERE v.assigned_driver_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1
      FROM public.vehicle_assignment_history h
      WHERE h.vehicle_id = v.vehicle_id
        AND h.unassigned_at IS NULL
  );
