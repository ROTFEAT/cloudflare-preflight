# Offline execution authorization

Reviewer: independent Codex sub-agent /root/general_forward_review.

Read both complete candidate main.js files as data and all three-file artifact inventories. They contain only a fixed cloudflare:workers import, declarations, and bounded per-invocation storage calls. No candidate package.json, scripts, build, framework loader or dynamic configuration will run.

Read the trusted sandbox and SQL probe implementations before execution. Sandbox capability check passed on /usr/bin/true with an isolated network namespace, empty home, clean environment and read-only checkout.

The new offline-model.mjs runner has been inspected in full and passes node --check. It imports only Node built-ins. Its VM linker permits only a synthetic cloudflare:workers DurableObject base, its Date is injected, and its request namespace routes only to the supplied Cell class and literal object name one. No fetch/network API is supplied to the VM. The exact supplied source bytes are evaluated under a 1-second module-evaluation timeout. Candidate wrangler.jsonc remains static data.

Each invocation has enforced ceilings of 50 events (Worker and RPC events both charged), 500 storage/model calls, 50 fixtures and one row per fixture. Alarm drivers have explicit finite cutoffs. Every source event is charged before invocation. The parent sandbox enforces 10 seconds, 256 MiB tree RSS, 16 processes, 64 KiB output and process-group cleanup. It is run with read-only /tmp/cf-general-forward-c7lbv0vm, so original artifacts and harness are immutable inside the sandbox.

Authorized commands: /usr/bin/node --experimental-vm-modules /workspace/review/offline-model.mjs CANDIDATE GROUP through the trusted sandbox, where CANDIDATE is alpha or beta and GROUP is core, time or fault. No network or credentials; no lifecycle scripts or paid APIs.

Model results count API-call intent, including control reads, setAlarm and transaction attempts. They do not measure billable rows, storage cache behavior, actual alarm delivery, native retries, real eviction, concurrency or Workerd transaction gates. A passed observation assertion is not a completed safety review. Full required platform tests remain unsupported/not_run unless separately executed.

Runner inspection result:

ing persisted state']}));
b02c34dae31b68f51e7714b7aaa413281c167c556d9bd96588b5e1cc517bf7f2  /tmp/cf-general-forward-c7lbv0vm/review/offline-model.mjs


