# Delayed work, origin access and stop evidence

Apply these checks within the existing Cloudflare cost review: CF-DO-001/002, CF-JOB-001, CF-Q-001/002, CF-HTTP-001 and CF-SAFE-001. They do not grant cloud access or change the Skill's deployment/manual invocation scope.

## Delayed alarms and checkpoints

For an alarm schedule, review every refresh, expiry, lease and retry transition, including stored timestamps left by earlier releases. Advance a local injected clock before, at and after each boundary. A 30-day TTL with a 7-day refresh window needs coverage around days 23 and 30, plus a missed refresh and a restart during the transition.

Check past, repeated, non-finite and backwards timestamps. A successful handler can create another already-due alarm without entering the platform's exception retry budget. Require persistent progress or a verified per-window work bound; a future timestamp or backoff alone does not prove bounded cumulative work. Legitimate recurring services may continue with enforced work and instance limits.

`do-time-boundaries` is required when the local reachable graph schedules an alarm. The application test must record its time boundaries and finite event/work ceilings; the tool's own fixture tests do not satisfy an application's evidence requirement. Unknown external scheduling still needs semantic review and an explicit gap.

## Public Worker paths to downstream origins

Trace public entry points through local helpers to external or dynamic fetches. Inspect allowed targets, redirects, forwarded credentials/headers, custom domains, `workers.dev`, preview/alternate routes and any directly reachable downstream URL. Verify where authentication and admission limits actually run. Intentionally public endpoints may be valid if their expensive work is demonstrably bounded.

`origin-access` is required when a public Worker handler reaches an unresolved external/dynamic fetch. Use local doubles to test direct-origin and alternate-route requests, invalid credentials, allowed requests and rejected-request work counts. A check inside a serverless origin may protect business work while still incurring an invocation; record both scopes. This is not a Lambda account integration or a complete external API billing analysis. Missing origin configuration or provider contracts remains INCOMPLETE, not an inferred protection.

## Background stop and remaining work

`background-stop` is required for reachable alarm scheduling, Cron handlers and configured Queue consumers. Simulate a persistent disable/terminal state, an already-pending callback/message, a restart, and work already in flight. Record the bounded additional billable/control operations after stopping, including retries and backlog effects. Verify that stale callbacks cannot rearm or create new work after the terminal state. An unavoidable control-state read is not zero usage.

Test locally with bounded synthetic work and no cloud credentials. Do not invent a global Alarm pause, delete data or perform a production stop. If no actual stop mechanism or finite-work boundary is available, report the unresolved exposure under the applicable existing rule. Periodic services require an appropriate per-window bound and a documented, verifiable stop.

## Handoff

Use the existing usage assessment to state work limits, their scope, assumptions and code locations. Multiply admitted events, fan-out, attempts and operations per attempt only when every factor is enforced; account for autonomous scheduled events and all active objects/environments. Unknown factors stay unknown, and monetary estimates remain unverified.

Separate observed code limits, completed local tests, cloud configuration verification and remaining actions. A proposed control or local test does not establish cloud-side protection. Keep the signed evidence and independent publisher gate unchanged in role.

## Design reference

These review scenarios were informed by [ZPVIP/no-billshock at 1250f01](https://github.com/ZPVIP/no-billshock/tree/1250f01a085cfe955e1189e38502b5a4428734da), especially its delayed-state, origin-bypass, bounded-stop and handoff guidance ([MIT license](https://github.com/ZPVIP/no-billshock/blob/1250f01a085cfe955e1189e38502b5a4428734da/LICENSE)). The checks and fixtures here are implemented for this repository's read-only Cloudflare preflight and evidence model; upstream instructions are not executed or installed.
