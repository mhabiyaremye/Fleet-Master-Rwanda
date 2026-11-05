-- Apply to the application's PostgreSQL database before enabling fuel planning.
BEGIN;

CREATE TABLE IF NOT EXISTS fuel_budget_proposals (
  proposal_id SERIAL PRIMARY KEY,
  budget_month DATE NOT NULL
    CHECK (budget_month = date_trunc('month', budget_month)::date),
  created_by INTEGER NOT NULL
    REFERENCES users(id) ON DELETE RESTRICT,
  justification TEXT NOT NULL
    CHECK (length(trim(justification)) > 0),
  status VARCHAR(30) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS fuel_budget_proposals_owner_month_idx
  ON fuel_budget_proposals (created_by, budget_month DESC, proposal_id DESC);

CREATE TABLE IF NOT EXISTS fuel_budget_items (
  proposal_id INTEGER NOT NULL
    REFERENCES fuel_budget_proposals(proposal_id) ON DELETE CASCADE,
  vehicle_id INTEGER NOT NULL
    REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT,
  energy_type VARCHAR(20) NOT NULL
    CHECK (energy_type IN ('petrol', 'diesel', 'electric', 'hybrid')),
  requested_litres NUMERIC(12, 3) NOT NULL DEFAULT 0
    CHECK (requested_litres >= 0),
  price_per_litre NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (price_per_litre >= 0),
  requested_kwh NUMERIC(12, 3) NOT NULL DEFAULT 0
    CHECK (requested_kwh >= 0),
  price_per_kwh NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (price_per_kwh >= 0),
  is_included BOOLEAN NOT NULL DEFAULT TRUE,
  estimated_cost NUMERIC(14, 2) NOT NULL DEFAULT 0
    CHECK (estimated_cost >= 0),
  PRIMARY KEY (proposal_id, vehicle_id),
  CHECK (
    energy_type IN ('electric', 'hybrid')
    OR (requested_kwh = 0 AND price_per_kwh = 0)
  ),
  CHECK (
    energy_type IN ('petrol', 'diesel', 'hybrid')
    OR (requested_litres = 0 AND price_per_litre = 0)
  )
);

CREATE INDEX IF NOT EXISTS fuel_budget_items_vehicle_idx
  ON fuel_budget_items (vehicle_id);

COMMIT;
