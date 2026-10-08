# Cloudflare Cost Safety

INCOMPLETE · gate DENY · 2026-10-08T11:04:05.727Z

Official best practices: **INCOMPLETE**. Cost safety: **INCOMPLETE**.

Target: app-a / production / deploy. Input: `3fc0a30e1a0497195bc9a98bf3816268546cde8de372a52fb4526622b2865818`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 3 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | unknown | Declared DO namespace has no proven activation in the local call graph; external callers or previously scheduled alarms require evidence |
| CF-DO-002 | unknown | Declared DO namespace has no proven activation in the local call graph; external callers or previously scheduled alarms require evidence |
| CF-DEP-001 | pass |  |
| CF-SQL-001 | not_applicable |  |
| CF-SQL-002 | not_applicable |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | not_applicable |  |
| CF-Q-002 | not_applicable |  |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | not_applicable |  |
| CF-SAFE-001 | pass |  |

## Findings

No supported-pattern findings. This is not a completeness claim.

## Tests and unknowns

- bounded-local-probe: passed (51 ms); python3 trusted-skill/scripts/lib/probe.py
- Required test not completed: do-lifecycle
- Required test not completed: do-getalarm

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
