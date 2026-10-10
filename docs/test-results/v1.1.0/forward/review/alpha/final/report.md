# Cloudflare Cost Safety

BLOCK · gate DENY · 2026-10-10T08:41:40.716Z

Official best practices: **BLOCK**. Cost safety: **BLOCK**.

Target: review-alpha / default / deploy. Input: `2e4201551bfa2b8ed038c60d33ebf2b6a407f3b43b6765d8b553e0bb647c82ee`.

This result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: partial.

## Review summary

- **Risk paths:** 2 BLOCK findings; 2 REVIEW findings; 0 unresolved edges.
- **Work bound:** unbounded_path. Scope: One object activated by the visible public path; autonomous alarm chain lacks a finite bound..
- **Code-limit evidence:** No enforced limits recorded.
- **Execution-bound paths:** 4. Evidence gaps: execution_bounds:one_current_application_test_required.
- **Local tests:** 4 passed. Required checks still missing: execution-bounds, do-lifecycle, do-getalarm, do-time-boundaries, background-stop.
- **Cloud controls:** NOT VERIFIED by this read-only tool. Local tests and code/configuration declarations do not establish operational protection.

Recorded usage assessment: events=unknown; queue_deliveries=0; new_messages=0; sql_rows_read=unknown; sql_rows_written=unknown; kv_reads=0; kv_writes=0; kv_lists=0; r2_class_a=0; r2_class_b=0; active_objects=unknown; environments=unknown.
Assumptions: The supplied static files are the complete raw candidate; main.js is analyzed as the raw artifact, not a verified final publisher build.; Top-level/default environment selected for analysis; actual authorized release target, action, builder and publisher tool provenance remain unresolved.; The visible Worker path routes to literal object one in one configured namespace; external bindings/callers and historical active objects/environments are unknown.; Model API calls are not billed rows. Actual platform exception retries, storage caching/transactions and native admission controls were not measured..

## Official context

| Skill | Revision | Load | Review | References |
|---|---|---|---|---|
| workers-best-practices | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |
| wrangler | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 0 |
| durable-objects | 41e0d19858946d18af9ee2c2feebbe2e11d829ff | reviewed | reviewed | 3 |

## Cost rules

| Rule | Result | Gaps |
|---|---|---|
| CF-DO-001 | finding |  |
| CF-DO-002 | finding |  |
| CF-DEP-001 | pass |  |
| CF-SQL-001 | pass |  |
| CF-SQL-002 | finding |  |
| CF-JOB-001 | not_applicable |  |
| CF-Q-001 | not_applicable |  |
| CF-Q-002 | not_applicable |  |
| CF-KV-001 | not_applicable |  |
| CF-R2-001 | not_applicable |  |
| CF-HTTP-001 | unknown | Public entry/WAF/cache/admission scope cannot be verified from this repository; The default fetch handler ignores method/path/host/credentials and always invokes begin. Local invalid-credential GET and arbitrary-host OPTIONS both reach the DO. There is one fixed stub, with small per-request work; whether this public behavior is intended and which native WAF/admission controls cover workers.dev/custom/preview/internal routes is unverified. No external origin fetch exists, so origin-access is not generated/applicable to these supplied artifacts. Request volume is an assumption, not an enforced global budget. |
| CF-SAFE-001 | pass |  |

## Findings

- **BLOCK CF-DO-001** (both, high, High: reachable source invariant plus isolated injected-clock observations; actual delivery frequency and billing metrics not measured.) main.js:5 — An unchanged expiry turns the refresh alarm into a successful already-due scheduling loop.
  Path: main.js:8 public fetch -> CELLS.getByName('one').begin() → main.js:4 store expires=T+5 days -> plan(record) → main.js:5 alarm at max(now,expires-2 days)=T+3 days → main.js:6 alarm reads and rewrites unchanged record -> plan(record) → main.js:5 at/after day 3 rearm at now, with no terminal transition even after day 5. Units: .
  Persist a real progress/refresh transition or terminal state before scheduling; require a positive derived next transition and a justified job/window work bound, plus stale-callback/restart stop evidence. Do not delete stored data or invent an account-level DO pause.
- **BLOCK CF-DO-002** (cost_safety, high, High: alarm never mutates expiry/progress and has no exhaustion predicate; no production extrapolation required.) main.js:6 — The background logical job has no persistent progress, allowance, time-window bound, or stop.
  Path: main.js:6 nonempty record always causes get -> unchanged put -> plan → main.js:5 plan schedules at now once expiry-margin is due → main.js:4 any additional request replaces the record and its future schedule. Units: .
  Prove finite persisted progress or a recurring-service window with enforced rate/work/instance counts and a verifiable durable stop; test the first attempted callback after exhaustion, crashes and restarts.
- **REVIEW CF-SQL-002** (cost_safety, medium, High for redundant API calls; actual billed row counts/cache behavior remain unsupported.) main.js:6 — Each loop iteration persists an unchanged record and schedules another alarm; idempotent result does not make storage work free.
  Path: main.js:6 get('record') -> put('record',record) without mutation → main.js:6 -> main.js:5 setAlarm. Units: .
  After repairing progress/stop correctness, retain essential progress persistence while removing writes that do not represent a state transition. Measure storage and schedule usage separately with the actual supported runtime.
- **REVIEW CF-HTTP-001** (cost_safety, medium, High for reachable operations; exposure, intended authorization and native admission controls unverified.) main.js:8 — Every accepted public method/path starts or rewrites the job and alarm.
  Path: main.js:8 fetch -> CELLS.getByName('one').begin() → main.js:4 put(record) -> setAlarm via plan. Units: .
  Confirm the intended public contract and exported native admission/control coverage; add an application check only for a verified gap. State request volume and scope assumptions explicitly, including denied-request control work.
- **ADVISORY official** (official_best_practices, low, High: no observability keys or logs in the supplied artifacts; account defaults are unverified.) wrangler.jsonc:1 — Logs and traces are not explicitly configured, so there is no exported evidence of production observation coverage.
  Path: main.js:8 public fetch -> DO.begin → main.js:6 background alarm. Units: .
  Verify the production observability settings and use structured event/progress logging with justified sampling. Do not treat this advisory as an independent cost BLOCK.

## Tests and unknowns

- bounded-local-probe: passed (48 ms); python3 /home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/lib/probe.py 256
- offline-model-core: passed (224 ms); python3 /home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/sandbox.py --cwd /tmp/cf-general-forward-c7lbv0vm --timeout 10 --memory-mb 256 -- /usr/bin/node --experimental-vm-modules /workspace/review/offline-model.mjs alpha core
- offline-model-time: passed (224 ms); python3 /home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/sandbox.py --cwd /tmp/cf-general-forward-c7lbv0vm --timeout 10 --memory-mb 256 -- /usr/bin/node --experimental-vm-modules /workspace/review/offline-model.mjs alpha time
- offline-model-fault: passed (223 ms); python3 /home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/sandbox.py --cwd /tmp/cf-general-forward-c7lbv0vm --timeout 10 --memory-mb 256 -- /usr/bin/node --experimental-vm-modules /workspace/review/offline-model.mjs alpha fault
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
