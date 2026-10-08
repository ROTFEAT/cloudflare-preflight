# Cloudflare Cost Safety

BLOCK · gate DENY · 2026-10-08T10:28:30.532Z

Official best practices: **INCOMPLETE**. Cost safety: **BLOCK**.

Target: app-c / production / deploy. Input: `72a95c342bec174b686d609606ac974d89c42a67a4d2b6415e2d5e2e67fa59df`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | loaded | not_run | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | not_applicable | not_applicable | 0 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | not_applicable |  |
| CF-DO-002 | not_applicable |  |
| CF-DEP-001 | not_applicable |  |
| CF-SQL-001 | not_applicable |  |
| CF-SQL-002 | finding |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | not_applicable |  |
| CF-Q-002 | not_applicable |  |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | unknown | Public entry/WAF/cache/admission scope cannot be verified from this repository; HTTP fetch always reaches D1 UPDATE. No code-level admission control exists and account WAF/cache/routes/workers.dev coverage is unavailable. Neither client behavior nor CPU limits can establish a table-write or global monthly ceiling. |
| CF-SAFE-001 | pass |  |

## Findings

- **BLOCK CF-SQL-002** (cost_safety, high, high_for_supported_pattern) main.js:1 — Reachable SQL writes every row because its predicate is absent or always true
  Path: fetch → run → bind → prepare. Units: rows written, index writes, storage operations.
  优先官方存储/行数计量和现有受支持限制；不要自动删除数据或关闭必要持久化。

## Tests and unknowns

- bounded-local-probe: passed (45 ms); python3 trusted-skill/scripts/lib/probe.py
- sql-plan: passed (45 ms); python3 trusted-skill/scripts/lib/probe.py
- official_semantic_review_missing:wrangler
- Required test not completed: sql-rows

## Native control coverage

- Workers/cpu_limit: CPU per invocation; not SQL, wait time, cross-event or monthly usage. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/workers/platform/limits/).
- Billing/budget_alert: Notification only; no pause or hard cap. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/billing/manage/budget-alerts/).
- D1/query_plan_and_meta: Measure reads/writes, including index writes; not a per-query price ceiling. Current configuration: unknown. NOT_EXECUTED. [Official source](https://developers.cloudflare.com/d1/platform/pricing/).

## Remaining coverage

Unknown edges: 0. Excluded products: AI/external charges, Workflows, DO WebSocket/active duration, R2 object event loops, logs/traces. Dollar estimate: unknown.

- Unverified release path: Direct CLI
- Unverified release path: Cloudflare dashboard
- Unverified release path: Unverified Workers Builds deployment and preview commands
- Unverified release path: Independent CI
