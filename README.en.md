# Cloudflare Cost Safety

[简体中文](README.md) | **English**

**Current release: 1.00** · npm/report version: `1.0.0` · Git tag: `v1.00` · [Changelog](CHANGELOG.md) · [Versioning](docs/versioning.md)

A Codex Skill for **reviewing cost risks before a Cloudflare deployment**, named `cloudflare-cost-safety`. It combines official best practices, source and configuration analysis, bounded local tests, and an independent release gate to find self-scheduling alarms, Queue feedback, SQL read/write amplification, preview environment multipliers, and excessive polling or synchronization.

It answers four questions: **Where does usage originate? How can it multiply? Where are limits enforced? What evidence is still missing?** Reports include actual source locations, execution paths, test records, and gaps in controls.

**Preflight does not deploy, connect to your account, stop services, or promise a hard monthly spending cap.** Missing reviews, dependencies, targets, or required tests deny release. Installing the Skill does not intercept arbitrary CLI, dashboard, or Workers Builds deployments.

## Why this Skill exists

Working code, successful acknowledgements, and a query returning one row do not independently establish a usage bound. Public billing self-reports, incident writeups, and community work informed these checks:

- **Background work without users:** DO activation and alarm rescheduling can keep storage operations running. In-memory budgets may reset after reactivation.
- **A message ends while the logical task continues:** A Queue consumer may call an API that creates a fresh message. Per-message retries may not bound the whole business chain.
- **One query affects many rows:** Missing indexes, a removed WHERE clause, repeated upserts, or stalled batch progress can amplify rows read or written.
- **Frequency and environments multiply small tasks:** Preview background jobs, R2 backups, and client polling can repeatedly multiply otherwise small operations.
- **Controls have narrower scopes than expected:** Budget emails, CPU limits, paused Queue delivery, and local test resets do not establish an account-wide spending cap.

### Incidents and all message/community sources

These nine cases and 15 message/community sources come from the project's original requirements. The table distinguishes first-person accounts, snippets, and secondary archives. We have not independently audited their invoices or complete production code. Cases motivate mechanisms; official documentation and controlled tests support technical judgments. Amounts and causal caveats are preserved in [section 5 of the original requirements, in Chinese](docs/requirements.zh-CN.md).

| Case | Reported problem and resulting review focus | Sources and evidence type |
| --- | --- | --- |
| C01 · shmily7 | DO alarm loops and recurring storage usage; inspect rescheduling and cumulative work | [Original X post](https://x.com/shmily7/status/2107481028726251762), [Billflare secondary archive](https://billflare.dev/cases/shmily7-durable-object-alarm); the full narrative mainly relies on secondary material |
| C02 · Will Moss | Activation/initialization repeatedly schedules alarms; multiple previews amplify background work | [Hacker News self-report](https://news.ycombinator.com/item?id=47787042), [Reddit self-report](https://www.reddit.com/r/CloudFlare/comments/1snckwa/cautionary_tale_for_anyone_using_cloudflare/); two accounts of one incident |
| C03 · RetainDB | Queue → API → Queue feedback, repeated writes, KV fallback scans, and external traffic interact | [Reddit self-report and corrections](https://www.reddit.com/r/CloudFlare/comments/1t1e8nh/i_accidentally_generated_16_billion_durable/); the entire bill cannot be attributed to one loop |
| C04 · Nathan Schram | Cron/batch jobs repeatedly process the same data; inspect durable progress and crash replay | [Author's incident writeup](https://littlebearapps.com/blog/d1-billing-disaster-circuit-breakers/) |
| C05 · OSM | A refactor removes WHERE, changing an update by ID into a full-table UPDATE | [Author's postmortem and code fragment](https://www.ofsecman.io/post/postmortem-5-000-incident-in-10-seconds-due-to-cloudflare-d1) |
| C06 · Daryl Ginn | High D1 reads; the archive attributes amplification to indexes omitted during migration | [Original X post](https://x.com/darylginn/status/2082413530243043780), [Billflare secondary archive](https://billflare.dev/cases/darylginn-d1-missing-index); original snippets plus a secondary causal explanation |
| C07 · Justin Schroeder | A small number of DOs loop internally; few instances do not establish low usage | [Original X post](https://x.com/jpschroeder/status/2086144942657712500), [Billflare secondary archive](https://billflare.dev/cases/standard-agents-durable-objects); no complete code establishing a specific alarm implementation |
| C08 · Lucian Ghinda | Frequent Litestream/R2 replication operations; inspect synchronization intervals and environment multipliers | [Original X post](https://x.com/lucianghinda/status/1957738066816446683), [Billflare secondary archive](https://billflare.dev/cases/lucianghinda-r2-replication); original snippets plus secondary mechanism details |
| C09 · KurosawaGeeker | Voting-site and community review experience; inspect polling, caching, and Worker request paths | [cloudflare-cost-playbook](https://github.com/KurosawaGeeker/cloudflare-cost-playbook), [community cloudflare-cost-review Skill](https://raw.githubusercontent.com/KurosawaGeeker/cloudflare-cost-playbook/refs/heads/docs/cloudflare-cost-playbook/SKILL.md); a community repository's account and reference implementation |

Attribution is preserved, and reposts of one incident are not counted as separate cases. Machine-readable records are in the [incident index](.agents/skills/cloudflare-cost-safety/assets/incidents.json) and [source index](.agents/skills/cloudflare-cost-safety/assets/sources.json).

## When checks run

There are two entry points: **before deployment** and **manual invocation through a `/` command**. Explicit Skill mentions also support an early review.

### 1. Before deployment

When a task is about to deploy, publish, preview, release to staging, promote a version, or roll back on Cloudflare, the Skill description guides Codex toward preflight. This includes release commands wrapped by npm, frameworks, or Node scripts. For example:

```text
Deploy this project to Cloudflare production after completing the cost safety review.
```

Ordinary Alarm/Queue/SQL edits, command explanations, and confirmed local-only builds/tests are outside the default trigger scope. A copy-only change that needs a release still requires review. Implicit selection depends on the host version and matching behavior, so the controlled release entry always calls the gate explicitly. The complete host implicit-trigger matrix has not been verified.

### 2. `/` command or explicit mention

In supported Codex CLI/IDE clients, enter `/skills`, select **cloudflare-cost-safety**, and describe the project and review target. You can also write:

```text
$cloudflare-cost-safety Review this project's Cloudflare cost risks and generate a report before deploying.
```

The `/` entry uses the host's `/skills` selector; available menus depend on the client version. See the [official OpenAI Skills documentation](https://developers.openai.com/codex/skills/). Confirm the host discovers the installed Skill; restart the client if it does not appear.

## Prepare and verify locally

Requirements: Node ≥22, Python ≥3.10, Linux, bubblewrap, and libseccomp2. Download dependencies in a separate preparation phase without running npm lifecycle scripts:

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

The installer stays offline, refuses to overwrite an existing Skill, and copies 11 prepared production dependencies with licenses, including the Python sandbox. `npm run check:package` creates `.cost-safety/cloudflare-cost-safety-1.0.0.tar.gz`, actually extracts it, and runs the CLI offline with only the clean application available. The archive can also be extracted into an application's `.agents/skills/`. Host discovery is required; this project's tests do not establish automatic reload or implicit matching for a particular Codex build.

Installed version identity is recorded in the Skill's [version.json](.agents/skills/cloudflare-cost-safety/version.json). Run `node /TRUSTED/skill/scripts/cli.mjs version` to inspect the display version, standard version, and Git tag. `--version` prints only the standard version.

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

Semantic records follow the [schema](.agents/skills/cloudflare-cost-safety/assets/semantic-review.schema.json): all 12 rules, actual files/lines, official file hashes, model/invocation details, and actual test commands and runner digests. Unexecuted tests use `not_run` and null. Trusted reviewers remain responsible for review quality; a signature does not prove program termination.

| Exit code | Meaning |
| --- | --- |
| 0 | PASS, or REVIEW with valid signed approval for each finding |
| 1 | Known BLOCK, taking precedence over missing information |
| 2 | INCOMPLETE or unapproved REVIEW |
| 3 | Tool invocation/execution error |

## Official dependencies and rules

The project vendors `workers-best-practices`, `wrangler`, and `durable-objects` from `cloudflare/skills` at commit `41e0d19858946d18af9ee2c2feebbe2e11d829ff`, preserving Apache-2.0 licensing. Each run reads entries and applicable references and checks hashes against the [lock](.agents/skills/cloudflare-cost-safety/official-skills.lock.json). It never silently updates from main. Reports distinguish loaded/reviewed and official/cost conclusions.

The [rule catalog](rules/catalog.json) contains all 12 P0 contracts, cases, and sources. The implementation uses TypeScript AST, local call closure, real JSONC/TOML parsing, and a SQL parser. [Coverage documentation, in Chinese](docs/coverage.md) details each rule and its test evidence. ORM, dynamic dispatch, external SDKs, unknown cloud state, and P1 products have explicit gaps; no static candidates does not establish safety.

## Independent gate and controlled releases

A trusted external reviewer uses `attest --review ... --private-key /EXTERNAL/key.pem --key-id ... --origin ... --run-id ...` to produce an Ed25519 envelope. `gate` accepts only keys/origins allowed by external trust and rechecks current source, artifacts, config, target, locks, policy, rules, tools, and required tests. A plain PASS JSON is insufficient. REVIEW requires scoped, expiring signed approvals and compensating controls; BLOCK and INCOMPLETE cannot be waived.

[Trust and signing documentation, in Chinese](docs/trust.md) provides the structures and local workflow. The [controlled local entry](scripts/release.mjs) defaults to gate and read-only handoff. It calls a publisher only with an explicit external publisher and `--execute`. Analysis refuses inherited Cloudflare credentials. The remote publication phase was not run during development.

The [Wrangler publisher example](examples/publisher-wrangler.mjs) supports prebuilt JavaScript deploy only. It rejects build.command and consumes verified bytes through sealed memfd files and a read-only namespace, with bundling/rebuilds disabled. Its offline dry-run was tested. Administrators, protected publishers, and actors with host debugging access are within the trust boundary; chmod alone does not guarantee immutability.

The [GitHub Actions example and setup instructions, in Chinese](docs/ci.md) separate gate and credentialed publication into distinct steps using a protected tool installation. Engineering CI is configured for pushes and pull requests; consult the repository's Actions for online results. The actual Cloudflare release workflow has not been executed. Direct CLI, dashboard, unconnected Workers Builds, and other CI remain **partial coverage**.

Actual implementation status, test counts, independent forward evaluations, and unexecuted items are in the [development report, in Chinese](docs/development-report.zh-CN.md). The original requirements are preserved in [requirements.zh-CN.md](docs/requirements.zh-CN.md).

## Official references and acknowledgements

The case table lists all 15 message/community sources. These are all 17 official references from the source index, for 32 sources in total. Official capabilities, metering units, and command semantics are checked against the appropriate official references; community material provides incident context and practical experience.

| Topic | Official sources |
| --- | --- |
| DO alarms and storage metering | [Alarms](https://developers.cloudflare.com/durable-objects/api/alarms/), [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/) |
| D1 row metering | [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/) |
| Queue retry and pause scopes | [Batching and retries](https://developers.cloudflare.com/queues/configuration/batching-retries/), [Pause and purge](https://developers.cloudflare.com/queues/configuration/pause-purge/) |
| Local runtime tests | [Workers Vitest test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/) |
| Worker limits and billing | [Platform limits](https://developers.cloudflare.com/workers/platform/limits/), [Pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| KV billing | [Workers KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/) |
| R2 request classes and billing | [R2 Pricing](https://developers.cloudflare.com/r2/pricing/) |
| Budget notifications | [Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/) |
| Official Agent Skills | [cloudflare/skills](https://github.com/cloudflare/skills), [workers-best-practices entry](https://raw.githubusercontent.com/cloudflare/skills/main/skills/workers-best-practices/SKILL.md), [durable-objects entry](https://raw.githubusercontent.com/cloudflare/skills/main/skills/durable-objects/SKILL.md), [wrangler entry](https://raw.githubusercontent.com/cloudflare/skills/main/skills/wrangler/SKILL.md) |
| Workers Builds release configuration | [Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/) |
| Codex Skill discovery and invocation | [OpenAI Skills](https://developers.openai.com/codex/skills/) |

Upstream main links locate the material; execution uses the pinned commit and content hashes described above. Thanks to the authors of Cloudflare's official Skills and documentation, developers who publicly shared incidents, and the KurosawaGeeker community project. Source status and verification dates are recorded in [sources.json](.agents/skills/cloudflare-cost-safety/assets/sources.json).

## License

Project code uses the [MIT License](LICENSE). Bundled Cloudflare Skills retain their [Apache-2.0 license](.agents/skills/cloudflare-cost-safety/vendor/CLOUDFLARE-LICENSE) and [attribution](.agents/skills/cloudflare-cost-safety/vendor/NOTICE). Prepared third-party dependencies retain their own licenses.
