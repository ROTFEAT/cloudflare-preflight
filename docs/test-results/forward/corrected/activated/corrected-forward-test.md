# Corrected explicit host forward test: activated

**BLOCK; publisher handoff DENY.** Cost: BLOCK; scoped official semantic review: PASS. No publisher/account/remote effects.

HTTP fetch calls TASKS.getByName("shared").activate() at line 7; Task is exported and bound to TASKS. Instantiation runs constructor line 3, which synchronously creates DO-owned jobs table and schedules an alarm. Alarm line 5 consumes SELECT * FROM jobs and rearms after getAlarm() is null, without checking for pending work or durable terminal condition. Under the pinned alarm semantics an executing handler can see null; this check prevents overlap and supplies no cumulative limit. This confirms the supported source-level recurrence with valid schema, including empty work. No runtime alarm or billable row measurement occurred. Constructor setAlarm is unawaited; lifecycle/failure/eviction behavior remains untested.

Final artifact: [/tmp/cloudflare-cost-safety-forward-corrected/activated/main.js](/tmp/cloudflare-cost-safety-forward-corrected/activated/main.js:5). Config/binding/class migration: [/tmp/cloudflare-cost-safety-forward-corrected/activated/wrangler.jsonc](/tmp/cloudflare-cost-safety-forward-corrected/activated/wrangler.jsonc:12).

This is one focused **actual host explicit** `$cloudflare-cost-safety` rerun across two fixtures. It does not test implicit host selection or count CLI passes as three independent trials. Model known only as Codex, GPT-6 family; exact backend model identifier/version not exposed in session.

Frozen tool: `/tmp/cloudflare-cost-safety-forward-corrected/tool`. Before/after fingerprint: `66654b1d231d8cb1064a3fee6c986219578e781f17427426e564fcebdc9a222f`. Source/config/tool identity and all file digests are preserved in corrected-forward-test.json.

Input digest: `f5f2a0b19c8965be0b3d33fb89b4dfe386889b99bc4a45b6b1b565f619e0ddac`. Artifact SHA-256: `3ed08f237542901f98987f17251560a7bddd04e693b53958b3d8a18352229454`.

## Actual commands and results

Initial preflight — exit 1, 1989 ms

```text
node /tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs preflight --root /tmp/cloudflare-cost-safety-forward-corrected/activated --config wrangler.jsonc --env production --artifact main.js --builder explicit-forward-direct-js@1 --action deploy --local-tests --output /tmp/cloudflare-cost-safety-forward-corrected/activated/.cost-safety/corrected
stdout: BLOCK: /tmp/cloudflare-cost-safety-forward-corrected/activated/.cost-safety/corrected/report.md
stderr: (empty)
```

Nullable not_run review reproduction — exit 3, 2086 ms

```text
node /tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs preflight --root /tmp/cloudflare-cost-safety-forward-corrected/activated --config wrangler.jsonc --env production --artifact main.js --builder explicit-forward-direct-js@1 --action deploy --local-tests --output /tmp/cloudflare-cost-safety-forward-corrected/activated/.cost-safety/corrected --review /tmp/cloudflare-cost-safety-forward-corrected/activated/.cost-safety/corrected/semantic-review.json
stdout: (empty)
stderr: cost-safety tool error: Cannot read properties of null (reading 'join')
```

Schema validation of nullable review — exit 0

```text
node /tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs validate --schema semantic-review --file /tmp/cloudflare-cost-safety-forward-corrected/activated/.cost-safety/corrected/semantic-review-null-not-run.json
stdout: valid
stderr: (empty)
```

Final semantic preflight with runtime tests left missing — exit 1, 2084 ms

```text
node /tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs preflight --root /tmp/cloudflare-cost-safety-forward-corrected/activated --config wrangler.jsonc --env production --artifact main.js --builder explicit-forward-direct-js@1 --action deploy --local-tests --output /tmp/cloudflare-cost-safety-forward-corrected/activated/.cost-safety/corrected --review /tmp/cloudflare-cost-safety-forward-corrected/activated/.cost-safety/corrected/semantic-review.json
stdout: BLOCK: /tmp/cloudflare-cost-safety-forward-corrected/activated/.cost-safety/corrected/report.md
stderr: (empty)
```

## Reads and semantic coverage

Actual frozen content read: SKILL.md; review-procedure, official-skills, platform-facts, native-controls, predeploy-gate and rules references; semantic-review schema and rules catalog. Pinned official revision: `41e0d19858946d18af9ee2c2feebbe2e11d829ff`. Each following entry/reference was read and semantically applied, not merely checked for existence.

- workers-best-practices: `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/workers-best-practices/SKILL.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/workers-best-practices/references/configuration.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/workers-best-practices/references/platform-apis.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/workers-best-practices/references/runtime-patterns.md`
- wrangler: `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/wrangler/SKILL.md`
- durable-objects: `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/durable-objects/SKILL.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/durable-objects/references/rules.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/durable-objects/references/testing.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/durable-objects/references/workers.md`

Trusted prepared Wrangler package/schema read: version 4.148.0 matches the fixture lock. No candidate CLI, script, dynamic config or build ran. Full source/config/lock read. Absolute paths, SHA-256 receipts and concrete official reasoning are in the JSON record.

| Rule | Semantic result | Evidence |
|---|---|---|
| CF-DO-001 | finding | main.js:3, main.js:7, wrangler.jsonc:12 |
| CF-DO-002 | unknown | main.js:3, main.js:7 |
| CF-DEP-001 | pass | wrangler.jsonc:1, main.js:7 |
| CF-SQL-001 | unknown | main.js:5, main.js:3 |
| CF-SQL-002 | not_applicable | main.js:1 |
| CF-JOB-001 | not_applicable | main.js:1, wrangler.jsonc:1 |
| CF-Q-001 | not_applicable | main.js:1, wrangler.jsonc:1 |
| CF-Q-002 | not_applicable | main.js:1, wrangler.jsonc:1 |
| CF-KV-001 | not_applicable | main.js:1, wrangler.jsonc:12 |
| CF-R2-001 | not_applicable | main.js:1, wrangler.jsonc:1 |
| CF-HTTP-001 | unknown | main.js:7, wrangler.jsonc:1 |
| CF-SAFE-001 | pass | main.js:3, wrangler.jsonc:1 |

Full reasons for all 12 rules are in semantic-review.json and corrected-forward-test.json. Missing public admission, historical activation and workload bounds remain unknown.

## Actual probe and missing runtime checks

- `bounded-local-probe`: passed, 46 ms, SQLite 3.37.2; runner `27455f39185a38c2bfc6ea7df931014826f671bd4cf78a522f4805e23d279245`.
- `sql-plan`: passed, 46 ms, SQLite 3.37.2; runner `27455f39185a38c2bfc6ea7df931014826f671bd4cf78a522f4805e23d279245`.

Activated query plan is `SCAN jobs`, compiled from the constructor-owned schema; dormant has no reachable query and returned an empty plan set. This is SQLite structural evidence. No actual DO alarm/eviction execution, DO cursor billing or D1 meta measurement occurred. Billing rows and dollar estimate remain null.

Application runtime tests **not_run**: `do-lifecycle`, `do-getalarm`, `sql-rows`. Their null runner/command/duration records are in runtime-tests-not-run.json. The final semantic tests array is empty, and coverage still denies missing checks.

## Observed tool defect

[/tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/lib/render.mjs:6](/tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/lib/render.mjs:6) calls `t.command.join()` even when a schema-valid `not_run` record has `command:null`. Frozen CLI schema validation exited 0 (`valid`); actual preflight exited 3 with `Cannot read properties of null (reading 'join')`. Both fixture reproductions are preserved. [/tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs:21](/tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs:21) writes report.json before rendering, so this failure emitted fresh semantic JSON while leaving the prior Markdown. The operational rerun used an empty semantic tests array and retained missing checks in coverage; no implementation was edited.

## Limits and separate release follow-up

- Application-specific do-lifecycle and do-getalarm tests were not run; activated sql-rows also not run.
- SQLite EXPLAIN is structural only; no DO cursor rows or D1 meta, runtime alarm, eviction or crash validation occurred.
- No live account, credential, WAF/cache/route, namespace/history, publisher, attestation or native-control operation was performed.
- Public request rates, production data sizes, external actors and old alarms remain unknown.
- Native controls are NOT_EXECUTED; plan applicability unknown; no monthly hard spending cap or dollar estimate.
- Direct CLI/dashboard/Workers Builds/independent CI paths remain unverified partial coverage.
- Prepared trusted node_modules is a symlink into the shared repo; package version/schema digests were inspected, not an independently sealed entire dependency tree.

Parent reports the earlier release findings fixed and tested elsewhere: refuse credentials before analysis, await asynchronous callback, publish through sealed memfd/read-only namespace, and document chmod as advisory. Those fixes were **not independently retested in this focused DO rerun**; prior review remains at `/tmp/cloudflare-cost-safety-forward/release-review.md`.
