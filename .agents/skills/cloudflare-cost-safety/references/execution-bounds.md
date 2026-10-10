# Review execution bounds from code

Apply this method on every cost review, before consulting incidents. Source,
effective configuration, platform contracts and executed local tests are inputs;
an incident report is optional context. Keep the existing 12 rule IDs as product
checks, not an exhaustive list of ways a program can generate work.

## Trace work and its next activation

Start at requests, RPC, initialization, alarms, scheduled handlers, consumers and
client timers. Follow local helpers, callbacks, resource calls and the next event
they can create. Include old persisted state and external activation when known.
Inventory reads, writes, scans, lists, requests and scheduling operations even
when they appear harmless individually. A successful callback, a cache hit or an
unchanged business result can still perform billable work.

Use `coverage.execution_bounds` as the minimum path list. It is derived from the
reachable local graph, loops and recursion, without incident names or dates.
Inspect the complete path, not just the operation at the recorded line. The
graph is incomplete for dynamic dispatch, SDK internals and cloud history:
investigate those separately and retain unknowns under the applicable rules.
Do not infer that an absent operation or obligation proves a safe program.

## State the invariant and scope

For each path, choose the scope that its code actually enforces:

| Scope | Evidence to seek |
|---|---|
| One invocation | Bounded input, loop iterations, query work and fan-out. Traffic volume remains a separate assumption. |
| One logical job | Persisted remaining work or attempt allowance that decreases across newly created events, restarts, partial failure and replay; a terminal state prevents rearming. |
| One time window | Enforced frequency, work per event, admission/object/environment counts and a defined window, plus a verifiable stop. Recurring services need not terminate forever. |

For every feedback edge ask: can it produce another event while preserving the
same due time, cursor, pending work or freshly reset allowance? Trace the state
transition and crash boundaries, not variable names such as `attempts`. A delay
alone changes the rate, not the amount of work per job. Platform failure retries
do not bound newly created messages or alarms. A per-invocation bound cannot
justify a cumulative claim for an autonomous chain.

Derive time boundaries from the candidate's expressions and stored values:
refresh, expiry, lease, retry, rounding, zero and invalid intervals. Test before,
at and after applicable boundaries, missed transitions, repeated timestamps and
clock movement. Do not require a universal one-minute or fifteen-minute delay,
or hard-code a particular TTL, table, SDK, handler name or incident rate.

Quantify work in appropriate units before money. Multiply admitted events,
fan-out, attempts, operations/rows per event and active instances/environments
only where each factor has enforcement evidence. Include control operations and
index/metadata writes; for SQLite-backed DOs, KV-style storage calls use SQLite
rows and `setAlarm()` itself writes a row. Cursor metrics alone do not count all
these paths. Keep unsupported meters and account-wide totals unknown; never use
test-harness limits, expected traffic, CPU caps or notification thresholds as an
application's cumulative budget.

## Challenge the invariant offline

The application-specific `execution-bounds` test is required for discovered
paths. Test applicable perturbations, not incident reproduction:

- Normal work, empty/no-progress work, and increasing input/data/fan-out.
- Exhausted allowance and the next attempted event, including denied-event
  control reads. The application must enforce its bound before the harness
  watchdog is reached; an interrupted loop is not a passing bounded-work test.
- Restart, duplicate delivery and a crash between side effect and progress/ack.
- Time transitions, terminal stop and pending/replayed callbacks after stopping.
- Partial batch success, changing message IDs or reset in-memory state where
  relevant. Test which state persists and which operations repeat.

The generated `required_scenarios` are a minimum. Add cases dictated by actual
code, including helpers or platform paths the parser cannot resolve. Use bounded
synthetic inputs, injected clocks and local doubles with the existing offline
sandbox. Inspect and authorize the test command first; do not execute candidate
package scripts or dynamic config to discover their effects.

Record actual observations under the test's `metrics`, validated by
`assets/execution-bounds.schema.json`: one `paths` record per generated `path_id`,
its `scope`, `max_events`, `work_limits`, source `enforcement` locations, `reason`
explaining progress/stop/replay and multiplication, and `observations` containing
`scenario`, concrete `case`, `events` and all the same work units. Time-window
records also need `window_ms`. Limits are enforced application bounds in that
scope; observations are measured scenario maxima, not guessed production usage.
Attach the actual command, runner digest, duration and current input digest in
the existing test record. Missing execution remains not_run/unsupported.

Preflight and the independent gate reject missing/duplicate paths, omitted
scenarios, invalid evidence locations, per-invocation claims for recognized
cross-event paths, missing units and observations exceeding bounds. The gate
recomputes the path list from current inputs. Structural checks cannot prove
the invariant, validate arbitrary test runners, or replace the trusted Agent's
semantic review. Never manufacture measurements to satisfy the schema.

An evidenced dangerous path is BLOCK; missing proof or unresolved high-risk
behavior is INCOMPLETE. Record legitimate bounded recurring work and business
tradeoffs with their actual scope. Use incident reports later to challenge the
method and its tests, rather than waiting for a report to decide what to inspect.
