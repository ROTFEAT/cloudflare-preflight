# Official dependency protocol

The project-specific `official-skills.lock.json` pins `cloudflare/skills` at `41e0d19858946d18af9ee2c2feebbe2e11d829ff`. Its Apache-2.0 license is preserved in `vendor/CLOUDFLARE-LICENSE`. The three skill trees are unmodified copies; their complete file manifests include all six reference files. No native Codex `dependencies.skills` field is claimed or used.

The resolver reads actual bytes, verifies their manifests/tree digests, rejects extra/missing files and unapproved sources or unresolved revisions, and produces a context packet. Baseline Workers and DO references are small and all relevant to full config/runtime review, so all are loaded when applicable. Wrangler has no reference files in this pinned tree; its entry links product docs. Do not invent upstream rule IDs: use file, section and content digest.

The review adapter is a structured local file produced by the current Agent or an independent reviewer. The orchestrator provides actual official text; the Agent must read it, inspect candidate code and record findings/reasoning and `reviewed_files`. Only then does the report transition loaded → reviewed. No model API is invoked or paid service required by the analyzer. Missing semantic review always denies publication.

For an update, retrieve the official repository in a separate explicitly allowed read-only network preparation stage, verify the exact commit and license, compare all skill/reference changes, update the lock and run the complete suite. The external trusted approver must also adopt the new lock/tool fingerprints. Never fetch main during a release or silently replace the official source. Local caches need the same provenance and approval. Updating model context does not authorize MCP/account operations.

CLI routing is version-sensitive. This pin directs `cloudflare.config.ts`/`cf` away from Wrangler; v1 reports the adapter gap. Preview resource isolation and command availability must come from actual generated config and the project's pinned CLI. A different production/preview environment requires re-evaluation even for the same commit.
