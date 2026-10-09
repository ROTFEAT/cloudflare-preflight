# Codex deployment Hook

The synchronous `PreToolUse` Hook checks supported Codex shell and MCP calls before execution. A recognized Cloudflare release is denied with instructions to use `$cloudflare-cost-safety`. The Hook does not call a model, execute application scripts, build, sign, publish, or load deployment credentials. The agent must actually perform the Skill review; a denial message is not a completed review.

## Installation and host trust

From the trusted source checkout, `npm run install-skill -- --project /APPLICATION` installs the Skill and adds a handler to `/APPLICATION/.codex/hooks.json`. Existing unrelated handlers are preserved. `--skills-dir` and manually extracting the Skill archive only install the Skill. To register an existing prepared installation, run:

```sh
npm run install-hook -- --project /APPLICATION --skill /TRUSTED/skills/cloudflare-cost-safety
```

In a Codex client with Hooks enabled, use `/hooks` in the CLI to inspect and trust the exact new definition. The project config layer also needs to be trusted. Changed definitions require renewed host trust. This repository includes `.codex/hooks.json` for its own checkout. Installation does not mark the Hook trusted or prove that a particular desktop/CLI build loaded it. See [official OpenAI Hook documentation](https://learn.chatgpt.com/docs/hooks).

## Commands and tools

| Operation | Examples and treatment |
| --- | --- |
| Worker or Pages publication | `wrangler deploy`, `publish`, `pages deploy`, `versions upload/deploy`, `triggers deploy`, `rollback` |
| Remote preview or secret release | `wrangler preview`, `dev --remote`, `secret put/delete/bulk`, version/preview secret writes |
| Cloudflare CLI and frameworks | `cf deploy`, `cf previews deploy`, `cf workers versions create`, OpenNext/NuxtHub deploy; deployment through other framework/infrastructure tools when the package declares Cloudflare |
| Package and shell wrappers | npm/pnpm/yarn/bun scripts, including pre/post lifecycle scripts; npx/exec/dlx, literal `cd` and package directory options, literal Node child-process calls and shell wrappers |
| HTTP and MCP publication | Mutating Worker/Pages API calls through curl/wget; Cloudflare publishing MCP tool names and explicit action/method fields |
| Local work | Quoted documentation, code reads, ordinary edits, known local build/test commands, help, types and recognized Wrangler dry runs do not start the full preflight. Dry runs inspect custom build commands; local dev also checks declared remote bindings. |

This is static inspection, not a complete shell or JavaScript interpreter. Dynamic shell expansion, cycles, non-literal child arguments, unsupported Cloudflare commands, filtered workspaces, or an opaque release wrapper stay INCOMPLETE when the target or effects cannot be established. Do not execute them to discover their effects. Names such as `ship` are inspected through the actual package scripts, so naming a deployment `build` does not bypass its pre/post scripts. Unknown generic release wrappers require target confirmation; known other-provider commands such as `vercel deploy` are outside the Cloudflare gate.

## Continue through the independent publisher

Direct shell/MCP publishing stays denied even after a signed review. To continue within the guarded Codex session, register this version's already reviewed and protected `scripts/release.mjs` installation outside the application:

```sh
npm run install-hook -- --project /APPLICATION \
  --skill /TRUSTED/skills/cloudflare-cost-safety \
  --release-entry /PROTECTED/cloudflare-preflight/scripts/release.mjs
```

For an existing cost safety handler, add `--replace` to update only that handler; unrelated hooks are preserved. Trust the changed definition again. New project installations can instead pass `--release-entry ...` directly to `install-skill`. The installer requires the external entry to match this version's controlled release source and pins its SHA-256. Protect the whole installation and its imports, Node runtime, trust, target and publisher; copying a single script is insufficient.

The permitted invocation is one literal command, using the exact Node path recorded after `--node` in the handler:

```sh
/usr/bin/node /PROTECTED/cloudflare-preflight/scripts/release.mjs \
  --request /EXTERNAL/release.json --execute --publisher /TRUSTED/publisher.mjs
```

Replace `/usr/bin/node` if the registered runtime differs. Request and publisher paths must be absolute and outside the application. Omitting `--execute --publisher ...` permits gate/staging only. Extra shell commands, interpreter options, environment prefixes and changed entry bytes do not get this exception. The Hook hands this invocation to the controlled entry; that entry independently runs `gate`, checks current signed inputs and immutable handoff, then calls the already authorized publisher. Unsigned/fake PASS, stale evidence, source/config/target drift and missing checks deny publication. The Hook does not issue authorization or make an untrusted publisher safe.

## Coverage and verification

The launcher bounds stdin at 1 MiB, strips inherited Node options and credentials from the analysis worker, gives it 128 MiB of Node heap and an eight-second watchdog, and returns a supported JSON denial on caught failures. Candidate metadata reads are bounded regular files; special files, symlinks and oversized files are refused. No candidate command or dynamic configuration is executed during inspection, and denial messages do not echo command arguments or secrets.

These checks cover calls observed by a loaded, trusted Hook. An external terminal, dashboard, independent Workers Builds/CI, interactive input to an existing `write_stdin` session, arbitrary interpreter/SDK code, executable plugins and client-specific tool exceptions can bypass static observation. Hook edits/disabling, an unavailable launcher, and failures before the launcher starts cannot be contained by this script. Keep the independent protected publisher gate; never claim global CLI interception or a monthly hard spending cap.

Offline tests exercise the actual Python/Node protocol, static positive/negative cases, failure handling, installation, and real gate rejection/acceptance using explicitly synthetic signatures and mock publishers. The package check actually extracts the archive and exercises deny and allow outcomes in a clean read-only network namespace. These are not a live host trigger evaluation, a production review, or a remote deployment.

Command semantics checked on 2026-10-09 against the pinned Wrangler 4.148.0 metadata/code and official [Worker commands](https://developers.cloudflare.com/workers/wrangler/commands/workers/), [Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/) and [Cloudflare CLI](https://developers.cloudflare.com/cf/projects/). `cf` releases are intercepted, but this tool's semantic/config adapter for `cf` still reports INCOMPLETE.
