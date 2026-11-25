# Fleet Master Rwanda — Engineering review

**Review date:** 2026-11-25  
**Source checkpoint:** `aef6108` on `master` (security remediation); reviewed application source at `d5f80d1`.  
**Status:** Initial backend engineering review complete; production approval not granted.

## Evidence and scope

Eight review areas were examined using source exports, terminal output and CI evidence. The database schema review includes the three authoritative migrations. The review is static except where actual test or command results are explicitly recorded. Frontend behavior, live production configuration, repository protection, code coverage and performance have not been independently verified.

### Verified baseline

- PostgreSQL 16 and Node.js 24 in Codespaces; CI uses Ubuntu 24.04, PostgreSQL 16 and Node.js 24.
- Assignment and maintenance services use transactions, row locking and assignment history. Maintenance completion does not itself return a vehicle to service.
- Local regression suite: 74 passed, zero failed, skipped or cancelled after dependency remediation (14 unit, 3 migration integration, 7 assignment integration, 38 maintenance integration, 12 HTTP integration).
- `npm ci` succeeded after remediation; `npm audit` and `npm audit --omit=dev` reported zero vulnerabilities. This is a point-in-time audit, not proof of application security.
- Security updates: body-parser 2.3.0 to 2.4.0, proxy-addr 2.0.7 to 2.0.8, qs 6.15.3 to 6.17.1. Nodemon and its dependency subtree were removed, replaced by `node --watch server.js`. Audited packages decreased from 124 to 99.
- Commit `aef6108`: only backend/package.json and backend/package-lock.json changed; 20 insertions, 358 deletions. Push successful. Backend CI #2 succeeded (32 seconds). Its individual test counts were not inspected; local counts above are verified. Native watch restart has not been explicitly confirmed.
- Historical untracked `.vscode/` and `migrations/000_create_core_tables.sql` were preserved; temporary review exports removed.

## Findings and remediation register

Priority: P1 = address before affected workflow is released; P2 = important hardening; P3 = measured improvement or later refinement. These are proposed priorities, not completed changes.

| ID | Priority | Finding | Acceptance evidence |
|---|---|---|---|
| ARCH-01 | P1 | No organization boundary in reviewed schema and routes. Customer deployment model undecided. | Recorded architecture decision; cross-tenant tests if shared, isolation tests if separate. |
| DB-01 | P1 | Vehicle API accepts 30-character plate and 100-character make/model; baseline limits each to 20. | Aligned limits; boundary HTTP tests; no 500 for invalid lengths. |
| DB-02 | P1 | Account role/status and several identity fields are nullable or unconstrained. | Lifecycle policy, preflight existing data, additive migration and constraint tests. |
| DB-03 | P1 | Current vehicle status/driver and history can diverge through direct writes. | Defined invariants, legacy reconciliation and cross-workflow regression tests. |
| DB-04 | P2 | Maintenance timestamp/status consistency not enforced at database level. | Validated lifecycle constraints; legacy/cancellation policy; ordering tests. |
| DB-05 | P2 | Vehicle timestamps lack timezone; other operational timestamps use timestamptz. | Historical timezone established, migration tested, event ordering verified. |
| ASSIGN-01 | P1 | Driver deactivation and assignment are not coordinated. | Defined custody/access policy; deterministic concurrent tests. |
| ASSIGN-02 | P1 | Vehicle-only unassignment may close a newer assignment after a stale request. | Expected assignment identity/version; stale operation rejected without writes. |
| ASSIGN-03 | P1 | Assignment/maintenance operations lack recorded authenticated actor. | Actor captured from trusted auth context in transaction; audit tests. |
| TX-01 | P1 | Repeated transaction wrappers; failure handling differs. | Shared utility where suitable; commit uncertainty, rollback failure, connection disposal tests. |
| TX-02 | P2 | CURRENT_TIMESTAMP is transaction start; lock contention may distort chronology. | Forced lock-wait tests; explicit event-time policy and consistent timestamps. |
| MAINT-01 | P2 | Concurrent edits can overwrite newer fields; cancellation not implemented. | Stale-write protection; cancellation policy before adding endpoint. |
| AUTH-01 | P1 | Login has distinguishable failures, no visible rate limiting, limited input validation. | Generic credential failures, validated inputs, tested throttling with trusted proxy policy. |
| AUTH-02 | P1 | Registration error paths can leave requests unanswered; duplicate checks race. | Reliable HTTP responses, unique constraint mapping, concurrent duplicate tests. |
| AUTH-03 | P1 | Approval/rejection/reactivation use separate read/update; competing transitions may race. | Atomic conditional transition, correct actor/role and concurrent tests. |
| AUTH-04 | P1 | Login/deactivation race may create a session after revocation; reactivation must not revive it. | Transactional policy and real endpoint race tests. |
| AUTH-05 | P1 | Bootstrap endpoint exposed at application level; admin authorization inconsistent. | Controlled bootstrap, shared role checks, unauthorized requests denied. |
| AUTH-06 | P1 | Logout/password recovery/change not present in reviewed routes. | Secure session revocation and recovery flows with abuse and replay tests. |
| AUTH-07 | P2 | JWT claim/config validation, session expiry policy, duplicate middleware and session cleanup need hardening. | Explicit config and claims; authenticate once per request; security/expiry tests. |
| API-01 | P2 | Maintenance history ID parser accepts alternate numeric formats and oversized integers. | Shared strict parser and invalid ID HTTP tests. |
| API-02 | P2 | Unknown vehicle history returns same empty response as existing vehicle without records. | Documented 404/200 contract, frontend compatibility and tests. |
| API-03 | P2 | Error mapping inconsistent; list endpoints unbounded; plate normalization unspecified. | Stable error codes, field contracts, normalization policy, pagination when justified. |
| FUEL-01 | P1 | Coercive numeric validation and JavaScript floating-point arithmetic before NUMERIC storage. | Strict decimal types/ranges; rounding and overflow policy; exact financial tests. |
| FUEL-02 | P1 | Database does not enforce energy/cost consistency; vehicle powertrain absent. | Agreed powertrain model; compatibility and calculation constraints/tests. |
| FUEL-03 | P1 | Fuel route contains transaction, validation, calculation and HTTP logic; approval workflow incomplete. | Tested service, draft/edit/submit/approve/reject transitions, actor and ownership controls. |
| TEST-01 | P1 | Account lifecycle, vehicle and assignment HTTP, fuel and browser workflows lack dedicated coverage in reviewed suite. | Risk-driven tests alongside each fix; regression suite stays green. |
| TEST-02 | P2 | Promise.allSettled does not force a particular lock interleaving; mock parameters not fully asserted. | Controlled concurrency and stronger SQL parameter/connection assertions. |
| TEST-03 | P2 | Shared test DB, fixed temporary migration fixture, uneven local-host checks and cleanup on abrupt exit. | Dedicated run isolation and bounded execution; explicit database safety checks. |
| MIG-01 | P1 | SQL transaction-control regex misses forms such as COMMIT WORK and same-line COMMIT. | Stronger validation and review policy; negative tests; production safety design. |
| MIG-02 | P1 | Populated legacy upgrade and restore not sufficiently demonstrated; current runner test-only. | Representative staging upgrade, preflight, verified backup restore, separate migration role. |
| MIG-03 | P2 | Local host restrictions incomplete; no explicit migration lock/statement deadline; checksum line endings may differ. | Consistent test guards, timeout policy, Git LF verification, preserve applied checksums. |
| CI-01 | P2 | CI uses mutable action tags and container/runtime versions; audit gate absent. | Verified pinning/update policy, production vulnerability gate, no skipped mandatory suites. |
| CI-02 | P2 | Minimal gitignore and repository protection not verified. | Secrets/history audit, safe ignores and sanitized example config; agree branch protection workflow. |
| CI-03 | P2 | Frontend build/tests, code coverage and Windows reproduction not verified in CI. | Add relevant checks and document runtime support. |
| PERF-01 | P3 | Potential missing indexes and per-item fuel queries; no representative benchmarks. | Query plans and load measurements before optimization. |

## Retain and improve

Retain the three applied migrations, the assignment and maintenance transaction architecture, real PostgreSQL failure-injection tests, and the current CI pipeline. Add future schema changes as new migrations. Do not modify applied files or recorded checksums to hide drift. No production migrations or customer deployment are authorized by this review.

## Review sources

Repository files: backend/database/migrations/0001_baseline_schema.sql, 0002_vehicle_assignment_history.sql, 0003_maintenance_integrity.sql; backend/scripts/migrate.cjs and run-integration-tests.cjs; backend/database/migration-validation.cjs; backend/services/vehicle-assignment-service.js and vehicle-maintenance-service.js; backend/auth-middleware.js and server.js; backend/vehicle-routes.js, maintenance-routes.js, fuel-planning-routes.js; backend/tests/*.test.cjs; backend/package.json and package-lock.json; .github/workflows/backend-ci.yml; .gitignore. Evidence: user-provided review exports, local command output and GitHub Actions screenshots from 2026-11-25.
