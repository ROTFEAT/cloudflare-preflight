# Independent forward review — alpha and beta

Review date: 2026-10-10. Reviewer: independent Codex sub-agent /root/general_forward_review. No incident report or prior reviewer conclusions were used.

**Alpha: BLOCK. Beta: INCOMPLETE, with a legitimate finite countdown in the valid initialized state.** Neither result is release authorization. Both final reports deny the release gate; there is no signing or publication.

## Alpha

At [main.js:4](/tmp/cf-general-forward-c7lbv0vm/alpha/main.js:4), begin stores expires = T + 5 days. [plan:5](/tmp/cf-general-forward-c7lbv0vm/alpha/main.js:5) schedules max(now, expires − 2 days), so the first transition is T + 3 days. [alarm:6](/tmp/cf-general-forward-c7lbv0vm/alpha/main.js:6) rewrites the unchanged record and schedules again. At/after day 3 it rearms at now, including at/after day 5, without progress, allowance or terminal state.

The bounded model delivered eight successful callbacks at the refresh boundary: begin plus callbacks made 8 get, 9 put and 9 setAlarm calls, with the same due schedule remaining. The eight-callback cutoff belongs to the harness. CF-DO-001 and CF-DO-002 describe this same underlying feedback path; they are not two independent loops. Repeated unchanged writes are an additional CF-SQL-002 REVIEW consequence.

One pending alarm and one literal object identity are legitimate concurrency/cardinality limits. They do not bound lifetime work. Platform exception retries do not bound successful callbacks that create another alarm.

## Beta

[begin:3](/tmp/cf-general-forward-c7lbv0vm/beta/main.js:3) persists remaining = 3 and returns for an existing ledger. [alarm:4](/tmp/cf-general-forward-c7lbv0vm/beta/main.js:4) decrements within a transaction, sets closed at exhaustion, and deletes the alarm.

For the valid new ledger, the model observed three committed countdown steps, then no rearm: 4 get, 4 put, 3 setAlarm calls including initialization, and 1 deleteAlarm call. Reconstruction and duplicate/closed callbacks did not replenish the allowance. Later callbacks and begin calls still perform control reads. The bound is on successful progress commits and their writes, not all invocations, failures or public traffic.

Malformed synthetic old ledgers with missing/infinite remaining continued scheduling in the model. Current begin does not create those states, so this is an existing-state uncertainty rather than a confirmed reachable BLOCK. A modeled crash after the initial ledger put but before scheduling can leave a ledger with no alarm that begin will not repair; actual storage gates and recoverability need runtime testing. This is a reliability question, not proof of cost runaway.

## Shared exposure and needed tests

Both fetch handlers accept every method/path/host/credential and invoke literal object one ([alpha:8](/tmp/cf-general-forward-c7lbv0vm/alpha/main.js:8), [beta:6](/tmp/cf-general-forward-c7lbv0vm/beta/main.js:6)). Invalid-credential GET and arbitrary-host OPTIONS reached the DO in the model. This deserves review of the intended public contract and actual admission controls, not an automatic BLOCK of small public requests. There are no downstream external fetches, Queues, Workers KV, R2 or Cron paths in the complete supplied files. No origin-access test is applicable to these artifacts.

Required full tests remain **not_run**: execution-bounds, do-lifecycle, do-getalarm, do-time-boundaries and background-stop. Application-specific completion should cover:

- Alpha: before/at/after days 3 and 5, missed transitions, repeated/backwards time, empty record, restart, begin replay, non-finite stored expiry, failure between record write and schedule, and a real persistent stop with pending/replayed/in-flight callbacks.
- Beta: before/at/after the 120000ms scheduling expression, three-step exhaustion and the next callback, duplicates, reconstruction, absent/closed/legacy ledgers, rollback/crash at each transaction/scheduling/cancellation boundary, concurrent begin/alarm, terminal pending callbacks, native retry limits, and initial put/schedule recovery.
- Both: account/environment/final artifact/builder/publisher identity; actual workers.dev/custom/preview/internal-route protections and external namespace callers; per-invocation versus logical-job bounds, including denied-event control reads.

The generated beta graph omits transaction callback storage.get/storage.put operations through the storage alias and gives its setAlarm/deleteAlarm resource = null. Its zero unknown-edge count therefore does not prove complete storage coverage. This review inspected the callback manually and counted those calls in the model. Execution-bound metrics for all generated paths were not fabricated to hide this limitation.

## Execution and evidence

The actual cloudflare-cost-safety 1.1.0 Skill, all three official pinned entries and all six references were read. All nine official file digests matched cloudflare/skills revision 41e0d19858946d18af9ee2c2feebbe2e11d829ff. Installed trusted Wrangler 4.148.0 matched each supplied raw lock. Configuration, exported Cell, binding CELLS and SQLite migration names agree.

Six inspected model runs used the supplied source bytes in a VM with an allowlisted synthetic platform import, injected clock, storage double and isolated read-only sandbox. Per-run ceilings: 50 charged events, 500 model/storage calls, 50 fixtures, one row per fixture, 10 seconds and 256 MiB tree RSS. Actual event counts were alpha 23/12/3 and beta 24/19/8. All observation assertions completed; this is not a passed Workerd safety test. The SQL probe had no queries and measured no application billing.

Actual billing rows, cache effects, transaction/eviction/concurrency behavior, native alarm delivery/retries and current cloud controls were not measured. Non-finite numeric fixture values serialize as null in raw JSON; case labels retain their original Infinity/NaN meaning. Currency remains null. Pinned primary-document mechanisms were used; there was no live network retrieval.

deleteAlarm is a per-object runtime control, not an external account pause or cancellation of work already running. CPU limits constrain CPU; budget alerts notify; request protections do not stop an existing alarm chain. Plan/backend/account scope, enforcement evidence and release bypass coverage remain unverified. No data was deleted, no controls were changed, no candidate scripts/dynamic configs ran, no Cloudflare account/credentials/remote operations were used, and the repository was not modified.

- Final reports: [alpha](/tmp/cf-general-forward-c7lbv0vm/review/alpha/final/report.md), [beta](/tmp/cf-general-forward-c7lbv0vm/review/beta/final/report.md), with adjacent report.json and official-context.json.
- Structured reviews: [alpha](/tmp/cf-general-forward-c7lbv0vm/review/alpha/semantic-review.json), [beta](/tmp/cf-general-forward-c7lbv0vm/review/beta/semantic-review.json). Both schemas validated; final review/input digests match.
- [Exact commands, exit codes and raw outputs](/tmp/cf-general-forward-c7lbv0vm/review/commands-and-results.json), [runner](/tmp/cf-general-forward-c7lbv0vm/review/offline-model.mjs), [execution authorization](/tmp/cf-general-forward-c7lbv0vm/review/offline-authorization.md), [official read/digest receipts](/tmp/cf-general-forward-c7lbv0vm/review/official-read-receipts.json).
- Per-candidate model-core.json, model-time.json and model-fault.json preserve measured API-call observations and sandbox results. commands.json is the earlier journal checkpoint; commands-and-results.json is the complete journal.

