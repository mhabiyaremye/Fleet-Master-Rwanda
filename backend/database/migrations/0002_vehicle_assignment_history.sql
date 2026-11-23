
-- Fleet Master Rwanda
-- Migration: 0002_vehicle_assignment_history.sql
--
-- Purpose:
-- Create permanent vehicle assignment history.
--
-- Requires:
-- 0001_baseline_schema.sql
--
-- The migration runner manages transactions.
-- Do not add BEGIN or COMMIT.

CREATE TABLE public.vehicle_assignment_history (
    assignment_id BIGINT GENERATED ALWAYS AS IDENTITY
        PRIMARY KEY,

    vehicle_id INTEGER NOT NULL
        REFERENCES public.vehicles(vehicle_id),

    driver_employee_id TEXT NOT NULL
        REFERENCES public.users(employee_id),

    assigned_at TIMESTAMPTZ
        DEFAULT CURRENT_TIMESTAMP,

    first_recorded_at TIMESTAMPTZ NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

    unassigned_at TIMESTAMPTZ,

    unassignment_reason VARCHAR(100),

    CONSTRAINT valid_assignment_period
        CHECK (
            unassigned_at IS NULL
            OR assigned_at IS NULL
            OR unassigned_at >= assigned_at
        )
);

-- Prevent a vehicle from having more than
-- one active assignment.

CREATE UNIQUE INDEX
    idx_one_active_assignment_per_vehicle
ON public.vehicle_assignment_history(vehicle_id)
WHERE unassigned_at IS NULL;

-- Prevent a driver from having more than
-- one active vehicle assignment.

CREATE UNIQUE INDEX
    idx_one_active_assignment_per_driver
ON public.vehicle_assignment_history(driver_employee_id)
WHERE unassigned_at IS NULL;

-- Improve vehicle assignment-history retrieval.

CREATE INDEX idx_vehicle_assignment_history
ON public.vehicle_assignment_history(
    vehicle_id,
    assigned_at DESC
);

-- Preserve assignments existing before
-- history tracking was introduced.
--
-- Original assignment timestamps are unknown.
-- Therefore assigned_at is deliberately NULL.
--
-- first_recorded_at identifies when the
-- existing assignment was registered.

INSERT INTO public.vehicle_assignment_history (
    vehicle_id,
    driver_employee_id,
    assigned_at
)
SELECT
    v.vehicle_id,
    v.assigned_driver_id,
    NULL
FROM public.vehicles AS v
WHERE v.assigned_driver_id IS NOT NULL;
