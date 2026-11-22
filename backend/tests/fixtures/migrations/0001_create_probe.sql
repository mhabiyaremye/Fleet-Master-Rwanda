-- Integration-test fixture.
-- Creates an isolated table to verify migration execution.

CREATE TABLE public.migration_test_probe (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);