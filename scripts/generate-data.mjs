import fs from 'node:fs';
import path from 'node:path';
import { SKILL_ROOT,VERSION,digest,sha256,writeJSON } from '../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';

const spec=fs.readFileSync('docs/requirements.zh-CN.md','utf8');
const upstreamRevision='41e0d19858946d18af9ee2c2feebbe2e11d829ff';
const officialNames={'CF-SKILL-DO':'durable-objects','CF-SKILL-WORKER':'workers-best-practices','CF-SKILL-WRANGLER':'wrangler'};
const sources=Object.fromEntries([...spec.matchAll(/^\[([A-Z0-9-]+)\]: (https:\/\/\S+)/gm)].map(m=>{
 const id=m[1],primary=id.startsWith('CF-')||id==='OPENAI-SKILLS',name=officialNames[id];
 return [id,{id,url:m[2],checked_at:primary?'2026-10-08':null,status:primary?'primary_source':'user_supplied_not_independently_verified',verification_basis:!primary?'Original user-provided source status; no independent source/invoice audit':name?'Actual pinned upstream file read; main URL is discovery only':'Official documentation/repository read during preparation; no cloud account or price validation',...(name?{resolved_url:`https://raw.githubusercontent.com/cloudflare/skills/${upstreamRevision}/skills/${name}/SKILL.md`}:{})}];
}));
writeJSON(path.join(SKILL_ROOT,'assets/sources.json'),{schema_version:'1.0',sources:Object.values(sources)});
const nativeLimits={
 'CF-DO-001':'One scheduled alarm per object does not cap future alarm invocations; deleteAlarm is object runtime API.',
 'CF-DO-002':'Single-event CPU and platform failure retries do not cap application-created alarms or SQL row usage.',
 'CF-DEP-001':'Preview URLs do not imply separate namespaces. Removing a route does not stop existing background alarms.',
 'CF-SQL-001':'LIMIT and returned rows do not bound scanned rows; plans and consumed-cursor metrics are required.',
 'CF-SQL-002':'Batch/upsert result idempotency does not imply zero write billing; indexes also incur writes.',
 'CF-JOB-001':'Cron frequency limits triggers, not repeated per-job work or crash replay.',
 'CF-Q-001':'max_retries and DLQ apply to one message, not new messages in the same logical task.',
 'CF-Q-002':'At-least-once delivery and acknowledgement cannot promise exactly-once side effects.',
 'CF-KV-001':'KV cache is not a global strongly consistent limiter; reads, writes, lists are distinct.',
 'CF-R2-001':'Free egress does not imply free requests. ListObjects is Class A; storage/retrieval are separate.',
 'CF-HTTP-001':'In-Worker cache hits still invoke the Worker; regional rate limits are not account-wide caps.',
 'CF-SAFE-001':'Budget alerts notify only. Test resets, CPU limits and queue pause are not a hard monthly cap.'
};
const blocks=[...spec.matchAll(/^### 8\.\d+ (CF-[A-Z0-9]+-\d+) — ([^\n]+)\n([\s\S]*?)(?=\n### 8\.|\n## 9\.)/gm)];
const rules=blocks.map(([,id,title,body])=>({id,title,candidate_trigger:body.match(/\*\*审查候选：\*\* ([^\n]+)/)?.[1],case_ids:[...new Set(body.match(/C\d\d/g)||[])],source_ids:[...new Set([...body.matchAll(/\[([A-Z][A-Z0-9-]+)\]/g)].map(m=>m[1]))],units:(body.match(/\*\*计量维度：\*\* ([^\n]+)/)?.[1]||'billable operations').replace(/。$/,'').split(/,\s*|，/),native_control_limit:nativeLimits[id],recommendation:body.match(/\*\*原生能力优先建议：\*\* ([^\n]+)/)?.[1],samples:[...body.matchAll(/^\| (危险|正常|不确定)[^|]*\| ([^\n]+)\|$/gm)].map(m=>({kind:{危险:'unsafe',正常:'safe',不确定:'unknown'}[m[1]],contract:m[2].trim()})),implementation:{static:'TypeScript AST, reachable local calls, effective bindings, SQL AST; narrow supported patterns only',agent:'Required for business semantics, platform applicability, budgets, false positives and unresolved edges',local_tests:'Dedicated safe/unsafe/unknown fixtures, bounded simulations and relevant Workers runtime/SQL tests',unsupported:'Arbitrary dynamic dispatch, external SDK internals, production configuration, prices and P1 products'}}));
const coverage={
 'CF-DO-001':['AST stub RPC activation → local constructor → alarm → storage → rearm; DO-owned schema required','workerd activation/alarm/eviction, getAlarm null and empty-work tests','External activation/history, Agents SDK internals and conditional schema initialization'],
 'CF-DO-002':['AST memory field/constructor reset plus alarm reschedule; persistent get guard distinguished','workerd eviction resets attempts while durable runs persist; finite task and periodic window','General transaction/fault invariants and arbitrary counter names require Agent evidence'],
 'CF-DEP-001':['AST newUniqueId plus activated class alarms; real JSONC/TOML environment bindings','Config drift/generator gaps; bounded shared/independent-resource models','Live namespace counts and expiry; no claim that a preview URL creates resources'],
 'CF-SQL-001':['SQL AST predicates/order/LIMIT plus per-database committed indexes and hot call closure','Actual DO SQL cursor rows and D1 local meta; SQLite plan probe separately labelled','Dynamic ORM/SQL, unsupported syntax, complex joins/selectivity and production schema'],
 'CF-SQL-002':['SQL AST whole-table UPDATE/DELETE on known database schema; hot vs maintenance entry','Actual DO broad writes, low selectivity, repeated upsert rowsWritten','General selective bounds, transactions, trigger/index amplification need workload evidence'],
 'CF-JOB-001':['Scheduled/alarm SELECT LIMIT + writes with no committed progress transition','Bounded checkpoint/crash simulation and finite DO work across eviction','Checkpoint transactions and external processing, arbitrary business progress semantics'],
 'CF-Q-001':['Consumer → same-repository cross-file producer → new send without preserved root/hops guard','Bounded 20-step fresh-ID/ack feedback and bounded root/hops chain with real Queue test helpers','External producers, DLQ replay semantics and real cloud Queue scheduling'],
 'CF-Q-002':['Billable side effects plus explicit retryAll without per-item ack','Bounded partial-success/write-before-ack/DLQ simulation using Queue test helpers','Exactly-once side effects, external payments and production delivery behavior'],
 'CF-KV-001':['KV list in unbounded AST loop without cursor advance; bounded loops distinguished','Actual local KV miss/list/cursor pagination; stuck cursor mutation','Business miss cardinality, globally consistent admission and cross-region state'],
 'CF-R2-001':['Reachable fast timer/alarm with unconditional put/list; change guard candidate','Actual local R2 put/list plus bounded frequency/environment arithmetic','S3/public access, object-event loops, change-detection/retry semantics and live scope'],
 'CF-HTTP-001':['Literal browser script served by configured assets + fast relative polling + costly Worker handler','Static same-origin asset fixture and public entry gaps; no live WAF test','Dynamic routes/templates, cache/WAF account state and general public traffic bounds'],
 'CF-SAFE-001':['Structured false control guarantees and reachable test reset helper','Five native scope falsification tests, signed false hard-cap schema rejection','Plan/contract applicability, runtime control state and any production isolation']
};
for(const rule of rules){const c=coverage[rule.id];rule.implementation={static:c[0],agent:'Mandatory semantic review with actual source locations and official context; static candidates are not complete coverage',local_tests:c[1],unsupported:c[2]};}
if(rules.length!==12||rules.some(r=>r.samples.length!==3))throw new Error('Requirements extraction failed');
writeJSON(path.join(SKILL_ROOT,'assets/rules/catalog.json'),{schema_version:'1.0',version:VERSION,rules});
fs.mkdirSync('rules',{recursive:true});fs.copyFileSync(path.join(SKILL_ROOT,'assets/rules/catalog.json'),'rules/catalog.json');
const cases=[...spec.matchAll(/^### 5\.\d+ (C\d\d) · ([^\n]+)\n([\s\S]*?)(?=\n### 5\.|\n\n## 6)/gm)].map(([,id,title,body])=>({id,title,evidence_level:body.match(/\*\*证据层级：\*\* `([^`]+)`/)?.[1],independently_audited:false,rule_ids:[...new Set(body.match(/CF-[A-Z0-9]+-\d+/g)||[])],sources:[...new Set([...body.matchAll(/\[([A-Z0-9-]+)\]/g)].map(m=>m[1]))]}));
writeJSON(path.join(SKILL_ROOT,'assets/incidents.json'),{schema_version:'1.0',cases,amounts_are_not_price_tests:true});
fs.writeFileSync(path.join(SKILL_ROOT,'references/rules.md'),spec.slice(spec.indexOf('## 8.'),spec.indexOf('## 9.')));
fs.writeFileSync(path.join(SKILL_ROOT,'references/incident-index.md'),'# Incident evidence\n\nNine user-supplied public self-reports/archives motivate mechanisms, not verified invoices or price expectations. See [machine-readable incident index](../assets/incidents.json), [sources](../assets/sources.json), and the project requirements for original caveats. Never present a fixture or third-party incident as evidence about the candidate repository.\n');
const filesIn=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?filesIn(path.join(dir,e.name)):[path.join(dir,e.name)]);
const skills=['workers-best-practices','wrangler','durable-objects'].map(name=>{
 const base=path.join(SKILL_ROOT,'vendor',name);
 const files=Object.fromEntries(filesIn(base).sort().map(f=>[path.relative(base,f),sha256(fs.readFileSync(f))]));
 return {name,upstream_path:`skills/${name}`,resolved_local_path:`vendor/${name}`,files,content_tree_sha256:digest(files)};
});
writeJSON(path.join(SKILL_ROOT,'official-skills.lock.json'),{schema_version:'1.0',upstream:'https://github.com/cloudflare/skills',revision:'41e0d19858946d18af9ee2c2feebbe2e11d829ff',license:'Apache-2.0',license_verified:true,license_sha256:sha256(fs.readFileSync(path.join(SKILL_ROOT,'vendor/CLOUDFLARE-LICENSE'))),prepared_at:'2026-10-08',skills});
