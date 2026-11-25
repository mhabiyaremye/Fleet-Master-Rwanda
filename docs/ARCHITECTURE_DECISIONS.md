# Fleet Master Rwanda — Architecture decision register

**Initial register:** 2026-11-25. This records existing decisions and proposals; pending entries are not approvals. Revisit decisions with evidence as the product evolves.

## ADR-001 — Versioned database migrations

**Status:** Established in current implementation.  
**Decision:** `backend/database/migrations/` is authoritative. SHA-256 checksums and `schema_migrations` track applied migrations; advisory lock and transaction protect execution. Keep 0001–0003 unchanged. Preserve unknown original legacy assignment dates as NULL and use `first_recorded_at` for the recording time.  
**Consequences:** Schema changes require new migrations. Current migration runner is test-only; production upgrade/restore process remains pending. PostgreSQL 16 compatibility omits the known baseline transaction_timeout statement at execution while preserving source checksum.

## ADR-002 — Transactional vehicle operations

**Status:** Established in current implementation.  
**Decision:** Assignment and maintenance services own transactional business rules; lock vehicle rows and protect active assignment history with unique partial indexes. Maintenance completion and readiness are separate states.  
**Consequences:** Vehicle cannot return to ordinary assignment until readiness is confirmed. Cross-table constraints, event ordering, actor audit, stale requests and account deactivation coordination still require design and tests.

## ADR-003 — Regression testing and CI

**Status:** Established in current implementation.  
**Decision:** Use Node test runner, actual PostgreSQL integration, real HTTP requests, isolated CI databases, locked dependency installation and sequential suites. CI runs on master pushes, pull requests and manual dispatch.  
**Consequences:** 74 local tests passed at the security checkpoint; CI #2 passed. No code-coverage percentage or full production readiness claimed. Strengthen test isolation, required checks and coverage as modules evolve.

## ADR-004 — Two-device development

**Status:** Established working agreement.  
**Decision:** Use GitHub as shared source, single master branch for now; keep environment and database state local to each device. Never commit .env or automatically overwrite historical local data.  
**Consequences:** Pull/check status before changing code, stage explicit files, push meaningful commits. PR-based protection would change this agreement and needs approval. Applied migration checksums require consistent line endings across environments.

## ADR-005 — Development server watcher

**Status:** Implemented at aef6108; restart verification pending.  
**Decision:** Replace nodemon with Node.js native `--watch` to eliminate vulnerable development dependency tree without forced downgrade.  
**Consequences:** Smaller dependency tree, zero reported backend vulnerabilities at remediation time. Native watch behavior must be verified on supported development environments.

## ADR-006 — Customer deployment and isolation model

**Status:** Pending; decide before customer/account schema expansion.  
**Options:** (A) Shared multi-tenant SaaS with organization-scoped records and authorization; (B) isolated deployment/database per customer; (C) hybrid isolation with explicit routing and operational ownership.  
**Trade-offs:** Shared tenancy reduces per-customer infrastructure but demands robust tenant isolation, tenant-aware uniqueness/foreign keys, authorization, backup and restore boundaries. Separate databases simplify some isolation boundaries but increase provisioning, upgrade and monitoring overhead. Hybrid adds routing complexity.  
**Decision criteria:** Customer count, contracts/data isolation, operational capacity, costs, recovery, onboarding and scaling. No model selected yet. The current schema does not establish shared-tenant isolation.  
**Acceptance:** Document selected model and threat boundaries; test isolation and administrative access; plan migration before expanding account APIs.

## ADR-007 — Account lifecycle and driver custody

**Status:** Proposed; approval required.  
**Proposal:** Ordinary driver deactivation should reject an unresolved active assignment or require an explicit custody transition. Emergency access suspension should revoke access immediately without automatically marking the vehicle available. Approval/rejection/reactivation must be atomic. Reactivation must never resurrect revoked sessions.  
**Open questions:** Who may suspend/reactivate; whether pending/rejected accounts may reapply; how custody is transferred; administrator recovery; session expiry policy.  
**Acceptance:** State transition matrix and deterministic tests for assignment/deactivation and login/deactivation races.

## ADR-008 — Actor accountability and concurrency

**Status:** Proposed.  
**Proposal:** Record authenticated actor, action, affected record, timestamp and appropriate reason for sensitive transitions. Define retention and access restrictions. Use expected assignment identity or version for stale writes. Standardize transaction failure handling and event timestamps after lock acquisition where appropriate.  
**Acceptance:** No spoofed actor input; failed operations leave no misleading committed events; audit records preserved under expected failures; stale requests rejected safely.

## ADR-009 — Financial arithmetic and vehicle energy

**Status:** Proposed.  
**Proposal:** Strict decimal input and exact arithmetic, with documented currency, scale and rounding policy. Store authoritative vehicle powertrain/energy compatibility. Establish draft/submitted/approved/rejected transitions and appropriate finance authority.  
**Open questions:** Currency and rounding granularity, conventional vs plug-in hybrid behavior, proposal revisions, historical prices and approval requirements.  
**Acceptance:** Reproducible costs, valid energy quantities, exclusion cost zero, overflow rejected, financial decisions auditable.

## ADR-010 — Deployment and secrets

**Status:** Proposed.  
**Proposal:** Separate application runtime, migration, test and backup privileges. Use controlled staging, HTTPS, environment-specific secrets, monitoring and verified recovery. Never use disposable CI credentials in production.  
**Acceptance:** Restore drill, staging upgrade, least-privilege verification, security review and release sign-off.
