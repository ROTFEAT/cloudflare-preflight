# Corrected explicit host forward test: dormant

**INCOMPLETE; publisher handoff DENY.** Cost: INCOMPLETE; scoped official semantic review: PASS. No publisher/account/remote effects.

fetch line 6 returns a constant response; the bound Task class is never obtained or invoked locally. Constructor/alarm declarations lines 3-4 do not establish activation. Standalone migrations/0001.sql is not executed by the DO constructor and cannot prove DO-owned table initialization. External callers, pre-existing instances and scheduled alarms are unknown. No supported reachable billable recurrence is established, so the former BLOCK is unjustified for these bytes. Missing activation/history/lifecycle evidence remains INCOMPLETE.

Final artifact: [/tmp/cloudflare-cost-safety-forward-corrected/dormant/main.js](/tmp/cloudflare-cost-safety-forward-corrected/dormant/main.js:6). Config/binding/class migration: [/tmp/cloudflare-cost-safety-forward-corrected/dormant/wrangler.jsonc](/tmp/cloudflare-cost-safety-forward-corrected/dormant/wrangler.jsonc:12).

This is one focused **actual host explicit** `$cloudflare-cost-safety` rerun across two fixtures. It does not test implicit host selection or count CLI passes as three independent trials. Model known only as Codex, GPT-6 family; exact backend model identifier/version not exposed in session.

Frozen tool: `/tmp/cloudflare-cost-safety-forward-corrected/tool`. Before/after fingerprint: `66654b1d231d8cb1064a3fee6c986219578e781f17427426e564fcebdc9a222f`. Source/config/tool identity and all file digests are preserved in corrected-forward-test.json.

Input digest: `3fc0a30e1a0497195bc9a98bf3816268546cde8de372a52fb4526622b2865818`. Artifact SHA-256: `187f558c1f9068268dfa9f060acb0b5d82d0acc9e8c0afe5caa170973a39b1f4`.

## Actual commands and results

Initial preflight — exit 2, 2082 ms

```text
node /tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs preflight --root /tmp/cloudflare-cost-safety-forward-corrected/dormant --config wrangler.jsonc --env production --artifact main.js --builder explicit-forward-direct-js@1 --action deploy --local-tests --output /tmp/cloudflare-cost-safety-forward-corrected/dormant/.cost-safety/corrected
stdout: INCOMPLETE: /tmp/cloudflare-cost-safety-forward-corrected/dormant/.cost-safety/corrected/report.md
stderr: (empty)
```

Nullable not_run review reproduction — exit 3, 2027 ms

```text
node /tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs preflight --root /tmp/cloudflare-cost-safety-forward-corrected/dormant --config wrangler.jsonc --env production --artifact main.js --builder explicit-forward-direct-js@1 --action deploy --local-tests --output /tmp/cloudflare-cost-safety-forward-corrected/dormant/.cost-safety/corrected --review /tmp/cloudflare-cost-safety-forward-corrected/dormant/.cost-safety/corrected/semantic-review.json
stdout: (empty)
stderr: cost-safety tool error: Cannot read properties of null (reading 'join')
```

Schema validation of nullable review — exit 0

```text
node /tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs validate --schema semantic-review --file /tmp/cloudflare-cost-safety-forward-corrected/dormant/.cost-safety/corrected/semantic-review-null-not-run.json
stdout: valid
stderr: (empty)
```

Final semantic preflight with runtime tests left missing — exit 2, 2235 ms

```text
node /tmp/cloudflare-cost-safety-forward-corrected/tool/scripts/cli.mjs preflight --root /tmp/cloudflare-cost-safety-forward-corrected/dormant --config wrangler.jsonc --env production --artifact main.js --builder explicit-forward-direct-js@1 --action deploy --local-tests --output /tmp/cloudflare-cost-safety-forward-corrected/dormant/.cost-safety/corrected --review /tmp/cloudflare-cost-safety-forward-corrected/dormant/.cost-safety/corrected/semantic-review.json
stdout: INCOMPLETE: /tmp/cloudflare-cost-safety-forward-corrected/dormant/.cost-safety/corrected/report.md
stderr: (empty)
```

## Reads and semantic coverage

Actual frozen content read: SKILL.md; review-procedure, official-skills, platform-facts, native-controls, predeploy-gate and rules references; semantic-review schema and rules catalog. Pinned official revision: `41e0d19858946d18af9ee2c2feebbe2e11d829ff`. Each following entry/reference was read and semantically applied, not merely checked for existence.

- workers-best-practices: `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/workers-best-practices/SKILL.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/workers-best-practices/references/configuration.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/workers-best-practices/references/platform-apis.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/workers-best-practices/references/runtime-patterns.md`
- wrangler: `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/wrangler/SKILL.md`
- durable-objects: `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/durable-objects/SKILL.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/durable-objects/references/rules.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/durable-objects/references/testing.md`, `/tmp/cloudflare-cost-safety-forward-corrected/tool/vendor/durable-objects/references/workers.md`

Trusted prepared Wrangler package/schema read: version 4.148.0 matches the fixture lock. No candidate CLI, script, dynamic config or build ran. Full source/config/lock/standalone SQL migration read. Absolute paths, SHA-256 receipts and concrete official reasoning are in the JSON record.

| Rule | Semantic result | Evidence |
|---|---|---|
| CF-DO-001 | unknown | main.js:3, main.js:6, wrangler.jsonc:12, migrations/0001.sql:1 |
| CF-DO-002 | unknown | main.js:3, main.js:6 |
| CF-DEP-001 | pass | wrangler.jsonc:1, main.js:6 |
| CF-SQL-001 | unknown | main.js:4, migrations/0001.sql:1 |
| CF-SQL-002 | not_applicable | main.js:1, migrations/0001.sql:1 |
| CF-JOB-001 | not_applicable | main.js:1, wrangler.jsonc:1 |
| CF-Q-001 | not_applicable | main.js:1, wrangler.jsonc:1 |
| CF-Q-002 | not_applicable | main.js:1, wrangler.jsonc:1 |
| CF-KV-001 | not_applicable | main.js:1, wrangler.jsonc:12 |
| CF-R2-001 | not_applicable | main.js:1, wrangler.jsonc:1 |
| CF-HTTP-001 | unknown | main.js:6, wrangler.jsonc:1 |
| CF-SAFE-001 | pass | main.js:3, wrangler.jsonc:1 |

Full reasons for all 12 rules are in semantic-review.json and corrected-forward-test.json. Missing public admission, historical activation and workload bounds remain unknown.

## Actual probe and missing runtime checks

- `bounded-local-probe`: passed, 47 ms, SQLite 3.37.2; runner `27455f39185a38c2bfc6ea7df931014826f671bd4cf78a522f4805e23d279245`.

Activated query plan is `SCAN jobs`, compiled from the constructor-owned schema; dormant has no reachable query and returned an empty plan set. This is SQLite structural evidence. No actual DO alarm/eviction execution, DO cursor billing or D1 meta measurement occurred. Billing rows and dollar estimate remain null.

Application runtime tests **not_run**: `do-lifecycle`, `do-getalarm`. Their null runner/command/duration records are in runtime-tests-not-run.json. The final semantic tests array is empty, and coverage still denies missing checks.

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
