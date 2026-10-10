# Cloudflare Cost Safety

INCOMPLETE · gate DENY · 2026-10-10T08:41:40.794Z

Official best practices: **PASS**. Cost safety: **INCOMPLETE**.

Target: review-beta / default / deploy. Input: `82e4b92473f5c5c20b3c2076491bbc5a113be6f0bc08ae1a82751e086f20b9c2`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Review summary

- **Risk paths:** 0 BLOCK findings; 1 REVIEW findings; 0 unresolved edges.
- **Work bound:** unknown. Scope: Valid newly initialized ledger has at most three successful countdown commits; all public/replayed/failed invocations, existing cloud state and account/environment totals remain unknown..
- **Code-limit evidence:** No enforced limits recorded.
- **Execution-bound paths:** 4. Evidence gaps: execution_bounds:one_current_application_test_required.
- **Local tests:** 4 passed. Required checks still missing: execution-bounds, do-lifecycle, do-getalarm, do-time-boundaries, background-stop.
- **Cloud controls:** NOT VERIFIED by this read-only tool. Local tests and code/configuration declarations do not establish operational protection.

Recorded usage assessment: events=unknown; queue_deliveries=0; new_messages=0; sql_rows_read=unknown; sql_rows_written=unknown; kv_reads=0; kv_writes=0; kv_lists=0; r2_class_a=0; r2_class_b=0; active_objects=unknown; environments=unknown.
Assumptions: The supplied static files are the complete raw candidate; main.js is analyzed as the raw artifact, not a verified final publisher build.; Top-level/default environment selected for analysis; actual authorized release target, action, builder and publisher tool provenance remain unresolved.; The visible Worker path routes to literal object one in one configured namespace; external bindings/callers and historical active objects/environments are unknown.; Model API calls are not billed rows. Actual platform exception retries, storage caching/transactions and native admission controls were not measured.; The finite-work argument assumes the ledger was produced by current begin with remaining=3 and closed=false, and actual storage.transaction is atomic. Malformed/legacy stored values are not proven reachable, and are not promoted to a confirmed BLOCK..

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | pass |  |
| CF-DO-002 | pass |  |
| CF-DEP-001 | pass |  |
| CF-SQL-001 | pass |  |
| CF-SQL-002 | pass |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | not_applicable |  |
| CF-Q-002 | not_applicable |  |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | unknown | Public entry/WAF/cache/admission scope cannot be verified from this repository; The default fetch handler ignores method/path/host/credentials and always invokes begin. Local invalid-credential GET and arbitrary-host OPTIONS both reach the DO. There is one fixed stub, with small per-request work; whether this public behavior is intended and which native WAF/admission controls cover workers.dev/custom/preview/internal routes is unverified. No external origin fetch exists, so origin-access is not generated/applicable to these supplied artifacts. Request volume is an assumption, not an enforced global budget. |
| CF-SAFE-001 | pass |  |

## Findings

- **REVIEW CF-HTTP-001** (cost_safety, medium, High for reachable operations; exposure, intended authorization and native admission controls unverified.) main.js:6 — Every accepted public method/path invokes the singleton and reads the ledger, including after terminal completion.
  Path: main.js:6 fetch -> CELLS.getByName('one').begin() → main.js:3 get(ledger); existing ledger returns, otherwise put and setAlarm. Units: .
  Confirm the intended public contract and exported native admission/control coverage; add an application check only for a verified gap. State request volume and scope assumptions explicitly, including denied-request control work.
- **ADVISORY official** (official_best_practices, low, High: no observability keys or logs in the supplied artifacts; account defaults are unverified.) wrangler.jsonc:1 — Logs and traces are not explicitly configured, so there is no exported evidence of production observation coverage.
  Path: main.js:6 public fetch -> DO.begin → main.js:4 background alarm. Units: .
  Verify the production observability settings and use structured event/progress logging with justified sampling. Do not treat this advisory as an independent cost BLOCK.

## Tests and unknowns

- bounded-local-probe: passed (49 ms); python3 /home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/lib/probe.py 256
- offline-model-core: passed (224 ms); python3 /home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/sandbox.py --cwd /tmp/cf-general-forward-c7lbv0vm --timeout 10 --memory-mb 256 -- /usr/bin/node --experimental-vm-modules /workspace/review/offline-model.mjs beta core
- offline-model-time: passed (229 ms); python3 /home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/sandbox.py --cwd /tmp/cf-general-forward-c7lbv0vm --timeout 10 --memory-mb 256 -- /usr/bin/node --experimental-vm-modules /workspace/review/offline-model.mjs beta time
- offline-model-fault: passed (230 ms); python3 /home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/sandbox.py --cwd /tmp/cf-general-forward-c7lbv0vm --timeout 10 --memory-mb 256 -- /usr/bin/node --experimental-vm-modules /workspace/review/offline-model.mjs beta fault
- execution-bounds: not_run (unknown ms); unknown
- do-lifecycle: not_run (unknown ms); unknown
- do-getalarm: not_run (unknown ms); unknown
- do-time-boundaries: not_run (unknown ms); unknown
- background-stop: not_run (unknown ms); unknown
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
