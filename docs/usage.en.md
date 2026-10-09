# Usage guide

[简体中文](usage.zh-CN.md) | **English** · [Back to the project](../README.en.md)

This page contains the full installation, CLI preflight, and controlled release instructions. The current version is **1.0.3**, with Git tag `v1.0.3`. The README, Skill, package, and reports use the same three-part version. Start with the README examples for an introduction.

## Prepare and verify locally

Requirements: Node ≥22, Python ≥3.10, Linux, bubblewrap, and libseccomp2. Download dependencies in a separate preparation phase without running npm lifecycle scripts:

The offline sandbox uses `/usr/bin/node`. If Node comes from nvm or a tool cache, install the verified binary into that protected system path and run the tests with the same Node. The GitHub CI preparation step includes this setup.

```sh
npm ci --ignore-scripts --registry=https://registry.npmjs.org
npm test
```

The unified command runs rule, integration, gate, and sandbox checks; real workerd tests; and a clean installation/package check. Actual logs go to `.cost-safety/test-results/`. Any failed stage exits nonzero. workerd runs with network isolation, a read-only checkout, and a parent watchdog. Unavailable namespaces cause failure rather than a fallback to networked tests.

## Install the Skill

```sh
npm run install-skill -- --project /ABSOLUTE/APPLICATION
# Or use a maintainer-protected tool directory for the reviewer:
npm run install-skill -- --skills-dir /ABSOLUTE/TRUSTED/skills
```

The installer stays offline, refuses to overwrite an existing Skill, and copies 11 prepared production dependencies with licenses, including the Python sandbox. `npm run check:package` creates `.cost-safety/cloudflare-cost-safety-1.0.3.tar.gz`, actually extracts it, and runs the CLI offline with only the clean application available. The archive can also be extracted into an application's `.agents/skills/`. Host discovery is required; this project's tests do not establish automatic reload or implicit matching for a particular Codex build.

Installed version identity is recorded in the Skill's [version.json](../.agents/skills/cloudflare-cost-safety/version.json). Run `node /TRUSTED/skill/scripts/cli.mjs version` to inspect the version and Git tag. `--version` prints only the version number.

A repository Skill supports discovery and review. The actual release verifier, trust file, and signing key must stay outside the candidate repository in a protected installation. Candidate code must not be able to modify the verifier and then obtain a signature or deployment credentials.

## CLI preflight and reports

The read-only analyzer can be invoked explicitly from a terminal or CI. Replace uppercase paths and versions with real values, using a protected external tool installation:

```sh
node /TRUSTED/skill/scripts/cli.mjs preflight \
  --root /APPLICATION --config wrangler.jsonc --env production \
  --artifact dist --builder ACTUAL_BUILDER_VERSION --action deploy \
  --local-tests --output /APPLICATION/.cost-safety
```

`main` must point to the final artifact under review. Build it beforehand; preflight does not execute your build scripts. `--env default` selects the top-level configuration. `production` selects `env.production` when present, otherwise the top level. The config path is relative to the repository; its `main` is relative to the config file.

The CLI reads actual installed Wrangler package metadata and the candidate lockfile; versions must match. For an externally installed publisher CLI, pass `--wrangler-package /TRUSTED/node_modules/wrangler/package.json` to both review and gate. Reading metadata does not run the candidate CLI. The publisher example also verifies its protected CLI version and metadata digest.

The first pass usually returns **INCOMPLETE / exit 2**. Read `report.json`, `report.md`, and `official-context.json`. After actual semantic review and required application tests, rerun with `--review /EXTERNAL/semantic-review.json`. A lack of static findings, a successful SQLite probe, or official file read receipts alone do not establish a completed review.

Semantic records follow the [schema](../.agents/skills/cloudflare-cost-safety/assets/semantic-review.schema.json): all 12 rules, actual files/lines, official file hashes, model/invocation details, and actual test commands and runner digests. Unexecuted tests use `not_run` and null. Trusted reviewers remain responsible for review quality; a signature does not prove program termination.

The report summary separates risks, work bounds, code limits, local tests, and unverified cloud controls. Applicable alarm paths need `do-time-boundaries`; background Alarm/Cron/Queue paths need `background-stop`; public Worker paths reaching external/dynamic fetches need `origin-access`. See the [additional checks and limits](../.agents/skills/cloudflare-cost-safety/references/delayed-and-origin-checks.md). Missing application evidence remains INCOMPLETE; the tool's own regression suite does not complete an application's acceptance tests.

| Exit code | Meaning |
| --- | --- |
| 0 | PASS, or REVIEW with valid signed approval for each finding |
| 1 | Known BLOCK, taking precedence over missing information |
| 2 | INCOMPLETE or unapproved REVIEW |
| 3 | Tool invocation/execution error |

## Official dependencies and rules

The project vendors `workers-best-practices`, `wrangler`, and `durable-objects` from `cloudflare/skills` at commit `41e0d19858946d18af9ee2c2feebbe2e11d829ff`, preserving Apache-2.0 licensing. Each run reads entries and applicable references and checks hashes against the [lock](../.agents/skills/cloudflare-cost-safety/official-skills.lock.json). It never silently updates from main. Reports distinguish loaded/reviewed and official/cost conclusions.

The [rule catalog](../rules/catalog.json) contains all 12 P0 contracts, cases, and sources. The implementation uses TypeScript AST, local call closure, real JSONC/TOML parsing, and a SQL parser. [Coverage documentation, in Chinese](coverage.md) details each rule and its test evidence. ORM, dynamic dispatch, external SDKs, unknown cloud state, and P1 products have explicit gaps; no static candidates does not establish safety.

## Independent gate and controlled releases

A trusted external reviewer uses `attest --review ... --private-key /EXTERNAL/key.pem --key-id ... --origin ... --run-id ...` to produce an Ed25519 envelope. `gate` accepts only keys/origins allowed by external trust and rechecks current source, artifacts, config, target, locks, policy, rules, tools, and required tests. A plain PASS JSON is insufficient. REVIEW requires scoped, expiring signed approvals and compensating controls; BLOCK and INCOMPLETE cannot be waived.

[Trust and signing documentation, in Chinese](trust.md) provides the structures and local workflow. The [controlled local entry](../scripts/release.mjs) defaults to gate and read-only handoff. It calls a publisher only with an explicit external publisher and `--execute`. Analysis refuses inherited Cloudflare credentials. The remote publication phase was not run during development.

The [Wrangler publisher example](../examples/publisher-wrangler.mjs) supports prebuilt JavaScript deploy only. It rejects build.command and consumes verified bytes through sealed memfd files and a read-only namespace, with bundling/rebuilds disabled. Its offline dry-run was tested. Administrators, protected publishers, and actors with host debugging access are within the trust boundary; chmod alone does not guarantee immutability.

The [GitHub Actions example and setup instructions, in Chinese](ci.md) separate gate and credentialed publication into distinct steps using a protected tool installation. Engineering CI is configured for pushes and pull requests; consult the repository's Actions for online results. The actual Cloudflare release workflow has not been executed. Direct CLI, dashboard, unconnected Workers Builds, and other CI remain **partial coverage**.

Actual implementation status, test counts, independent forward evaluations, and unexecuted items are in the [development report, in Chinese](development-report.zh-CN.md). The original requirements are preserved in [requirements.zh-CN.md](requirements.zh-CN.md).
