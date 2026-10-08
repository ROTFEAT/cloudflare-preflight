# Cloudflare Cost Safety

INCOMPLETE · gate DENY · 2026-10-08T11:14:00.232Z

Official best practices: **PASS**. Cost safety: **INCOMPLETE**.

Target: app-a / production / deploy. Input: `3fc0a30e1a0497195bc9a98bf3816268546cde8de372a52fb4526622b2865818`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | unknown | Declared DO namespace has no proven activation in the local call graph; external callers or previously scheduled alarms require evidence; fetch line 6 returns a constant response; the bound Task class is never obtained or invoked locally. Constructor/alarm declarations lines 3-4 do not establish activation. Standalone migrations/0001.sql is not executed by the DO constructor and cannot prove DO-owned table initialization. External callers, pre-existing instances and scheduled alarms are unknown. No supported reachable billable recurrence is established, so the former BLOCK is unjustified for these bytes. Missing activation/history/lifecycle evidence remains INCOMPLETE. |
| CF-DO-002 | unknown | Declared DO namespace has no proven activation in the local call graph; external callers or previously scheduled alarms require evidence; The declared constructor/alarm contain no durable cumulative job/window budget, but no local entry activates the class. External activation/history and job contract are absent. No finite-job or periodic-window/eviction claim is justified. |
| CF-DEP-001 | pass |  |
| CF-SQL-001 | unknown | The declared alarm contains full-table SELECT, but no proven activation or constructor-owned CREATE for jobs. The offline probe had zero reachable queries and did not validate this query/table. The standalone migration does not establish a DO-owned schema. Row-cost coverage is unresolved, not confirmed safe or confirmed billable. |
| CF-SQL-002 | not_applicable |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | not_applicable |  |
| CF-Q-002 | not_applicable |  |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | unknown | fetch returns a constant response, with no browser polling source or downstream call. Request rate and Cloudflare/native admission cannot be established from this fixture. WAF/cache/routes/account state was not accessed. Constant handler work is not a global request/spending bound. |
| CF-SAFE-001 | pass |  |

## Findings

No supported-pattern findings. This is not a completeness claim.

## Tests and unknowns

- bounded-local-probe: passed (47 ms); python3 trusted-skill/scripts/lib/probe.py
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
