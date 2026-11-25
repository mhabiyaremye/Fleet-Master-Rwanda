# Fleet Master Rwanda — Development roadmap

**Baseline:** 2026-11-25, `aef6108` on `master`.
**Goal:** Controlled initial customer rollout around January 2027, contingent on acceptance gates; not a promised release date.

This roadmap is proposed and should be refined as the product scope and customer architecture are agreed. See ENGINEERING_REVIEW.md for finding IDs and ARCHITECTURE_DECISIONS.md for decision status.

## Delivery sequence

| Phase | Deliverables | Exit criteria |
|---|---|---|
| 0 — Baseline | Preserve eight reviews; dependency remediation; document checkpoints | Docs reviewed and committed; native watch restart confirmed; 74 existing tests remain green. Dependency audit and CI already passed. |
| 1 — Product architecture | Deployment isolation model, account lifecycle, administrator boundaries, driver custody and audit policy | Decisions recorded; threat model and affected schema/API contracts identified; release scope agreed. |
| 2 — Shared foundations | Transaction handling, validation and error contracts, timestamp policy, test isolation | Targeted failure/validation tests, no regressions, compatible frontend behavior. Prioritize utilities needed by the next workflow rather than large speculative refactors. |
| 3 — Authentication and accounts | Login hardening; registration; admin authorization; atomic approval/rejection/deactivation/reactivation; bootstrap; logout; password recovery/change | Account transitions and concurrency tested through real HTTP/database; rate limiting and revocation verified; no secrets in logs. |
| 4 — Fleet operations | Actor audit; stale assignment protection; driver deactivation coordination; vehicle field limits; lifecycle constraints | End-to-end lifecycle and negative tests; legacy migration preflight; controlled concurrency. |
| 5 — Fuel planning | Exact decimal calculations; powertrain compatibility; draft/edit/submit/finance decision flow; financial audit | Financial reconciliation, overflow and rounding tests; ownership/role and rollback tests; approved budget immutability policy. |
| 6 — Frontend and performance | Verify build; browser workflows; error/session UX; accessibility; measured query and load improvements | Critical workflows pass browser tests; representative performance targets agreed and met. |
| 7 — Staging and rollout | Secure configuration, deployment roles, HTTPS, migrations, backups, restore drill, monitoring, customer acceptance | All applicable release gates below signed off before initial customer use. |

## Immediate implementation queue

1. Verify native watch mode if not yet observed; preserve the current baseline.
2. Agree the customer isolation/deployment model. It changes account ownership, authorization and database constraints, so avoid implementing account changes that assume an undecided model.
3. Define permitted account status transitions and how active vehicle custody is handled on deactivation.
4. Establish the first focused authentication change and its test cases. Inspect the exact current files before editing.
5. Implement and verify each change in small commits; keep existing migrations immutable.

## Engineering workflow

- Work on the agreed single `master` branch across home Windows and work Codespaces for now; branch protection/PR workflow remains a decision.
- Inspect status and synchronize before changes; preserve local databases and environment files.
- Define business invariants and tests before or alongside implementation. Do not treat passing tests as full coverage.
- Stage explicit file paths; inspect staged diff and whitespace; commit with meaningful messages; push and verify CI.
- Never share actual .env values or use production data for destructive tests. Use dedicated test databases and identities.
- For migrations: preflight, new versioned SQL, test empty and populated upgrades, verify rollback or recovery, never edit applied migrations.
- Re-run audits on dependency changes and before release. Zero reported vulnerabilities is only a point-in-time signal.

## Release gates (all applicable gates required)

| Gate | Required evidence | Status |
|---|---|---|
| Customer isolation | Approved model and tested access boundaries | Open |
| Account security | Real endpoint tests, revocation, secure bootstrap, recovery and rate limits | Open |
| Fleet integrity | Assignment/maintenance/custody invariants and actor audit verified | Partial: core services tested |
| Financial workflow | Accurate calculations and controlled financial decisions if in rollout scope | Open |
| Automated regression | All mandatory suites execute and pass; new changes covered | Partial: baseline 74/74 local, CI green |
| Frontend | Critical browser workflows and build verified | Open |
| Database deployment | Staging upgrade and restoration demonstrated | Open |
| Operational security | Secrets, TLS, least privilege, monitoring, incident response | Open |
| Customer acceptance | Documented acceptance against agreed pilot scope | Open |

If a feature is excluded from the pilot, it must be disabled or inaccessible rather than presented as production-ready. Track known residual risks and explicit acceptance decisions. Re-evaluate January 2027 after Phase 1 and staging verification.
