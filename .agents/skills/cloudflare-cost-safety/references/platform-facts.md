# Verified platform mechanisms

Documentation checked 2026-10-08; DO storage billing detail rechecked 2026-10-10. Verify the candidate version, plan, backend and compatibility target. These are mechanisms, not account observations or price calculations.

- [DO alarms](https://developers.cloudflare.com/durable-objects/api/alarms/): one scheduled alarm per object; setAlarm replaces it. An executing handler may see getAlarm=null. Application rescheduling and platform failure retries have different budgets. deleteAlarm is an object runtime API.
- [D1 billing](https://developers.cloudflare.com/d1/platform/pricing/): scanned/read and written rows are billed, not simply result rows or statement count. Index maintenance adds writes. Included usage belongs to its documented account/billing scope.
- [DO SQLite cursor](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/): consume as the business does before collecting rowsRead/rowsWritten. Do not apply D1 prices to DO KV/SQLite interchangeably.
- [DO storage billing](https://developers.cloudflare.com/durable-objects/platform/pricing/): SQLite-backed KV-style get/put/delete/list use a hidden SQLite table and are billed as rows; each setAlarm is one row written. SQL cursor metrics alone do not measure the full handler's storage work. Verify the backend and operations, without inferring a dollar amount.
- [Queue retries](https://developers.cloudflare.com/queues/configuration/batching-retries/): native limits govern delivery attempts of one message. Successful acknowledgement followed by a new send can continue a logical task. Do not flag omitted explicit retry settings as unlimited; verify platform defaults/version instead.
- [Queue pause](https://developers.cloudflare.com/queues/configuration/pause-purge/): stops delivery, not producers or retained storage. No exactly-once promise follows from ack/DLQ.
- [R2 pricing](https://developers.cloudflare.com/r2/pricing/): list is Class A; head/get are Class B under documented categories. Storage class, retention/retrieval and storage fees are separate from requests. Free egress is not free operations.
- [Budget alerts](https://developers.cloudflare.com/billing/manage/budget-alerts/): notification, not a usage hard cap or automatic pause.
- [Worker limits](https://developers.cloudflare.com/workers/platform/limits/): CPU limits do not cap SQL rows, waiting, cross-event tasks or monthly spend. The upstream context contains illustrative/historical limits; retrieve current applicable values before quoting numbers.
- [Test helpers](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/): runDurableObjectAlarm, eviction and reset are local testing tools for the supported main Worker context, not account management APIs.

The tool does not model prices. Usage remains unknown unless evidence supports the unit, window, factor multiplication and enforcement scope. Account state, console WAF configuration, storage duration and all P1 products stay explicitly unverified/excluded.
