# Focused release integration review

Reviewed 2026-10-08T10:52:00.799639+00:00. This is an implementation review with local synthetic plumbing probes, not another host invocation or implicit-trigger test. No repository implementation was edited. No Cloudflare account, remote operation, dependency download or publisher executable was used.

Reviewed release SHA-256: `fb6f1627a94256f98c3a83b826419df0b2138557d5678e46ba23d44dcac975db`. At report write: `fb6f1627a94256f98c3a83b826419df0b2138557d5678e46ba23d44dcac975db`. Gate SHA-256 at review: `89e57454507d2f81ac38c5f7ed02bf85011f183b941ced7d0535803f6ec5148f`.

## Findings

1. **P1 — Gate analysis shares the publisher credential environment.** `/home/ubuntu/github/cloudflare-preflight/scripts/release.mjs:17` calls gate in the current process; `/home/ubuntu/github/cloudflare-preflight/.agents/skills/cloudflare-cost-safety/scripts/lib/gate.mjs:51` calls preflight directly. The CLI publisher later receives `process.env` at `release.mjs:60`. A synthetic `CLOUDFLARE_API_TOKEN` canary was observable while gate snapshot enumerated the candidate root and again in the publisher callback. The sanitized SQL probe child does not isolate the surrounding Node analyzer. Use a credential-free analysis process and expose credentials only to the separately authorized publisher. No real credential values were requested or printed in this review.

2. **P2 — Exported API silently ignores asynchronous publisher failure.** `release.mjs:39` discards the publisher callback return value and immediately reports success at `:40`. A callback returning an already rejected Promise produced `allowed:true`, `exit_code:0`, `publisher_calls:1`; the rejection handler confirmed failure. Await the callback before reporting success, or explicitly reject asynchronous callbacks. The CLI callback uses synchronous spawnSync, so this finding affects the exported API rather than that particular CLI path.

3. **P2 — Staging is byte-checked but not immutable to its owner.** Copy verification at `release.mjs:25-29` establishes the copied snapshot at that moment. `:32-36` applies owner-controlled mode bits only. In a local probe, the publisher callback chmodded the staged artifact to writable and replaced its contents; controlledRelease still returned `allowed:true`. The same OS owner can do this between validation and actual consumption. Treat the current mechanism as staging that assumes no subsequent owner mutation, or use an immutable/read-only boundary and bind publisher consumption to the verified stage. This does not show a source-workspace race: ordinary source mutations after staging are successfully separated from staged bytes.

## Verified behavior and negative result

- `node --test tests/integration/release.test.mjs`: **2/2 passed**, exit 0. The tests cover denied-gate zero calls and unchanged staged artifact bytes after the original source is changed by a mock publisher.
- Independent denied-gate probe: `allowed:false`, `reason:release_identity_changed`, reported publisher calls **0**, observed callback calls **0**. `release.mjs:18` returns before staging/publishing; earlier exceptions also precede the callback.
- A possible omitted-artifact issue was tested rather than reported speculatively: final config and artifact `.cost-safety/final.js` produced **DENY**, `current_required_inputs_incomplete`, zero publisher calls. Thus that particular excluded-artifact bypass did not reproduce.
- Normal source staging copies every signed `scope.files` item, verifies each raw SHA-256, recomputes the staged source snapshot digest, and passes staged config/artifact paths. No rebuild is performed by this wrapper. The owner-mutability issue above is the remaining observed time-of-consumption limitation.

## Actual local probe results

| Probe | Result |
|---|---|
| Gate denied after changed source | DENY; callback calls 0 |
| Artifact in excluded .cost-safety path | DENY; callback calls 0 |
| Synthetic token environment | Visible during gate source snapshot and publisher callback |
| Returned rejected publisher Promise | allowed true; exit 0; publisher rejection observed |
| Owner chmod/rewrite of staged artifact | Staged hash changed; result remained allowed true |

The probes used existing `tests/helpers.mjs` mock semantic reviews and ephemeral Ed25519 test keys. They test release plumbing, not authentic Agent semantic review or deployment eligibility. Fixture and stage directories created by the independent probes were cleaned up. No real publisher, Cloudflare credentials, remote SQL or production data was used. Review output: `/tmp/cloudflare-cost-safety-forward/release-review.md`.
