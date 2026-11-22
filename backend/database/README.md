
# Fleet Master Rwanda — Database Infrastructure

## Overview

Fleet Master Rwanda uses PostgreSQL for persistent application data.

The authoritative migration directory is:

`backend/database/migrations/`

Migrations are applied through the Node.js migration runner.

## Current Baseline

`0001_baseline_schema.sql`

The baseline creates six application tables:

- users
- user_sessions
- vehicles
- maintenance_records
- fuel_budget_proposals
- fuel_budget_items

Migration execution is recorded in `public.schema_migrations`.

## Development Commands

Run commands from the backend directory.

### Unit tests

```bash
npm test
```

### PostgreSQL integration tests

```bash
npm run test:integration
```

Integration tests require a configured local PostgreSQL environment and pre-initialized test databases.

### Migration status

```bash
node scripts/migration-status.cjs fleet_master_baseline_test
```

### Apply migrations to an approved test database

```bash
node scripts/migrate.cjs apply fleet_master_baseline_test
```

The migration runner currently permits only explicitly allowlisted development databases.

## Safety Rules

1. Never edit an applied migration.
2. Create a new numbered migration for schema changes.
3. Back up existing databases before applying migrations.
4. Never apply the baseline to a database whose application tables already exist.
5. Never commit credentials or `.env` files.
6. Review and test migration SQL before execution.
7. Do not run integration tests against production data.

## Existing Database Registration

Existing databases require schema verification before their baseline can be registered.

A manual reconciliation was tested successfully against
`fleet_master_restore_test`.

Automated baseline registration is not yet implemented.

Do not use the test-only reconciliation procedure on production.

## Historical SQL Files

The repository also contains historical migration files:

- `backend/migrations/001_create_fuel_budget_tables.sql`
- `migrations/20261120_vehicle_assignment_history.sql`

These are not executed by the new migration runner.

They require schema reconciliation before consolidation.

## Current Limitations

- The migration runner is restricted to development databases.
- Integration tests depend on prepared PostgreSQL databases.
- Transaction-control detection is not a complete SQL parser.
- Automated production baseline registration is not implemented.
- Dedicated database roles and production deployment controls are pending.

## Future Work

- Automate isolated database creation for integration tests.
- Add production-safe migration configuration.
- Introduce least-privilege PostgreSQL roles.
- Reconcile historical migrations.
- Implement transactional vehicle assignment history.
- Add migration checks to GitHub Actions.
