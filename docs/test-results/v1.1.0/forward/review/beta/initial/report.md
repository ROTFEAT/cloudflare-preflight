# Cloudflare Cost Safety

INCOMPLETE · gate DENY · 2026-10-10T08:30:43.944Z

Official best practices: **INCOMPLETE**. Cost safety: **INCOMPLETE**.

Target: review-beta / default / deploy. Input: `82e4b92473f5c5c20b3c2076491bbc5a113be6f0bc08ae1a82751e086f20b9c2`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Review summary

- **Risk paths:** 0 BLOCK findings; 0 REVIEW findings; 0 unresolved edges.
- **Work bound:** unknown. Scope: unknown.
- **Code-limit evidence:** No enforced limits recorded.
- **Execution-bound paths:** 4. Evidence gaps: execution_bounds:one_current_application_test_required.
- **Local tests:** 1 passed. Required checks still missing: execution-bounds, do-lifecycle, do-getalarm, do-time-boundaries, background-stop.
- **Cloud controls:** NOT VERIFIED by this read-only tool. Local tests and code/configuration declarations do not establish operational protection.

Recorded usage assessment: events=unknown; queue_deliveries=unknown; new_messages=unknown; sql_rows_read=unknown; sql_rows_written=unknown; kv_reads=unknown; kv_writes=unknown; kv_lists=unknown; r2_class_a=unknown; r2_class_b=unknown; active_objects=unknown; environments=unknown.
Assumptions: Declared configuration describes the reviewed artifact; live account state is not inspected.

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 3 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | unknown | Alarm rescheduling needs a verified work or time-window boundary |
| CF-DO-002 | unknown | No verified cumulative logical-job or periodic-window budget |
| CF-DEP-001 | pass |  |
| CF-SQL-001 | not_applicable |  |
| CF-SQL-002 | not_applicable |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | not_applicable |  |
| CF-Q-002 | not_applicable |  |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | unknown | Public entry/WAF/cache/admission scope cannot be verified from this repository |
| CF-SAFE-001 | pass |  |

## Findings

No supported-pattern findings. This is not a completeness claim.

## Tests and unknowns

- bounded-local-probe: passed (50 ms); python3 /home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/lib/probe.py 256
- builder_identity_unknown
- Required test not completed: execution-bounds
- Required test not completed: do-lifecycle
- Required test not completed: do-getalarm
- Required test not completed: do-time-boundaries
- Required test not completed: background-stop

## Native control coverage

- Workers/cpu_limit: CPU per invocation; not SQL, wait time, cross-event or monthly usage. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/workers/platform/limits/).
- Billing/budget_alert: Notification only; no pause or hard cap. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/billing/manage/budget-alerts/).
- Durable Objects/deleteAlarm: Scheduled alarm on one object; not account isolation or cancellation of running work. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/durable-objects/api/alarms/).

## Remaining coverage

Unknown edges: 0. Excluded products: AI/external charges, Workflows, DO WebSocket/active duration, R2 object event loops, logs/traces. Dollar estimate: unknown.

- Unverified release path: Direct CLI
- Unverified release path: Cloudflare dashboard
- Unverified release path: Unverified Workers Builds deployment and preview commands
- Unverified release path: Independent CI
