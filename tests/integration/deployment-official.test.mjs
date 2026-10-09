import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {classifyIntent,resolveCommand} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/intent.mjs';
import {preflight,deduplicate,aggregate} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/preflight.mjs';
import {gate,signEnvelope} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/gate.mjs';
import {SKILL_ROOT,writeJSON,json,digest} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {application,temp,reviewed,opts,fixture,officialFinding} from '../helpers.mjs';

function mockPublisher(check,events) {events.push('preflight');if(!check.allowed)return;events.push('remote-publish');}
test('DEP-01 Chinese and English release intent precedes mock remote effect',()=>{
 for(const request of ['部署到CF','publish to Cloudflare']){const events=[];assert.equal(classifyIntent({request}).trigger,true);mockPublisher({allowed:false},events);assert.deepEqual(events,['preflight']);}
});
test('DEP-02 package and Node wrapper expansion is read-only',()=>{
 const texts=new Map([['release.mjs','import {spawnSync} from "node:child_process"; spawnSync("wrangler",["deploy"]);']]);
 for(const command of ['npm run ship','pnpm ship','yarn ship']){const r=resolveCommand(command,{ship:'node release.mjs'},texts);assert.equal(r.unknown,false);assert.ok(r.effects.some(e=>e.type==='cloudflare_release'));}
});
test('DEP-03 preview promotion and rollback require new identity and version',()=>{
 const r=reviewed();for(const action of ['preview','promote','rollback'])assert.equal(gate({...r,options:{...r.options,action,candidateVersion:'old-version'}}).allowed,false);
 assert.ok(preflight({...r.options,action:'rollback'}).report.incomplete.includes('candidate_version_required_for_promotion_or_rollback'));
});
test('DEP-04 independent Builds cannot consume only a PR check',()=>{
 const r=reviewed(),events=[];const result=gate({...r,envelope:{payload:{overall_status:'PASS'}}});mockPublisher(result,events);assert.deepEqual(events,['preflight']);assert.equal(r.report.deployment_gate_coverage,'partial');assert.ok(r.report.coverage.deployment_bypasses.some(s=>s.includes('Workers Builds')));
});
test('DEP-05 ordinary alarm queue SQL edits do not invoke; explicit review does',()=>{
 for(const request of ['修改 Alarm 代码','refactor Queue consumer','optimize SQL'])assert.equal(classifyIntent({request}).trigger,false);
 assert.equal(classifyIntent({request:'$cloudflare-cost-safety'}).trigger,true);
});
test('DEP-06 local commands explanations and other clouds do not deploy',()=>{
 for(const command of ['npm run test','pnpm build','vercel deploy'])assert.equal(classifyIntent({command}).trigger,false);
 for(const command of ['astro deploy','vite deploy']){const intent=classifyIntent({command});assert.equal(intent.trigger,true);assert.equal(intent.status,'unknown');}
 assert.equal(classifyIntent({request:'解释 wrangler deploy',context:'explain'}).trigger,false);
 const r=classifyIntent({command:'npm run build',scripts:{prebuild:'wrangler deploy',build:'tsc'}});assert.equal(r.trigger,true);
});
test('DEP-07 copy-only release still checks artifact and target',()=>{
 assert.equal(classifyIntent({request:'只改文案，部署到 CF'}).trigger,true);const r=reviewed();assert.equal(gate(r).allowed,true);
});
test('DEP-08 same commit different environment or binding invalidates approval',()=>{
 const r=reviewed();const cfg=json(path.join(r.root,'wrangler.jsonc'));cfg.env={preview:{name:'other-preview',kv_namespaces:[{binding:'KV',id:'other'}]}};writeJSON(path.join(r.root,'wrangler.jsonc'),cfg);
 assert.equal(gate({...r,options:{...r.options,environment:'preview'}}).allowed,false);
});
test('DEP-09 dirty source generated config lock and artifact invalidate evidence',()=>{
 for(const name of ['main.js','wrangler.jsonc','package-lock.json','new-source.js']){const r=reviewed();fs.appendFileSync(path.join(r.root,name),'\n ');assert.equal(gate(r).allowed,false,name);}
});
test('DEP-10 fake PASS expired review crash missing Agent all deny',()=>{
 const r=reviewed();assert.equal(gate({...r,envelope:{payload:{overall_status:'PASS'}}}).allowed,false);
 for(const change of [v=>v.review_identity=null,v=>v.tool_errors=['simulated_tool_crash'],v=>v.reviewed_at='2020-01-01T00:00:00Z',v=>v.tests=[]]){const report=structuredClone(r.report);change(report);assert.equal(gate({...r,envelope:signEnvelope(report,r.signer)}).allowed,false);}
});
test('OFF-01 baseline files and references are read, loaded is not reviewed',()=>{
 const r=preflight(opts(application()));const s=r.report.official_skills.find(s=>s.name==='workers-best-practices');assert.equal(s.load_status,'loaded');assert.equal(s.review_status,'not_run');assert.equal(s.loaded_references.length,3);assert.equal(r.context.filter(c=>c.path.includes('workers-best-practices')).length,4);assert.equal(r.report.official_best_practices_status,'INCOMPLETE');
});
test('OFF-02 class binding migration and Agent framework resolve DO context',()=>{
 for(const [kind,id] of [['safe','CF-DO-001'],['unknown','CF-DO-001']]){const r=preflight(opts(fixture(kind,id)));const s=r.report.official_skills.find(s=>s.name==='durable-objects');assert.equal(s.required,true);assert.equal(s.loaded_references.length,3);assert.ok(r.context.some(c=>c.path.endsWith('durable-objects/references/testing.md')));}
 const root=application({migrations:[{tag:'v1',new_sqlite_classes:['Hidden']}]});assert.equal(preflight(opts(root)).report.inventory.has_do,true);
});
test('OFF-03 Wrangler version loaded and cf CLI routing is incomplete',()=>{
 const root=application();let r=preflight(opts(root)).report;assert.equal(r.inventory.tool_versions.wrangler,'4.148.0');assert.equal(r.official_skills.find(s=>s.name==='wrangler').load_status,'loaded');
 fs.writeFileSync(path.join(root,'cloudflare.config.ts'),'throw new Error("must not execute")');r=preflight(opts(root)).report;assert.ok(r.incomplete.includes('cf_cli_routed_by_upstream_but_adapter_not_implemented'));
});
test('OFF-04 missing official dependency denies with no publisher calls',()=>{
 const r=preflight({...opts(application()),official:{root:temp()}}).report;assert.equal(r.overall_status,'INCOMPLETE');assert.ok(r.official_skills.some(s=>s.required&&s.load_status==='missing'));const events=[];mockPublisher({allowed:false},events);assert.deepEqual(events,['preflight']);
});
test('OFF-05 missing critical reference never counts as loaded',()=>{
 const copy=temp();fs.cpSync(SKILL_ROOT,copy,{recursive:true});fs.rmSync(path.join(copy,'vendor/workers-best-practices/references/runtime-patterns.md'));const r=preflight({...opts(application()),official:{root:copy}}).report;assert.notEqual(r.official_skills[0].load_status,'loaded');assert.equal(r.overall_status,'INCOMPLETE');
});
test('OFF-06 content drift upstream drift and same-name impostors rejected',()=>{
 for(const mode of ['content','revision','origin']){const copy=temp();fs.cpSync(SKILL_ROOT,copy,{recursive:true});if(mode==='content')fs.appendFileSync(path.join(copy,'vendor/workers-best-practices/SKILL.md'),'changed');else{const lock=json(path.join(copy,'official-skills.lock.json'));if(mode==='origin')lock.upstream='https://github.com/impostor/skills';else lock.revision=null;writeJSON(path.join(copy,'official-skills.lock.json'),lock);}const r=preflight({...opts(application()),official:{root:copy}}).report;assert.notEqual(r.official_skills[0].load_status,'loaded');}
});
test('OFF-07 neither official nor cost BLOCK can be hidden by other PASS',()=>{
 const a=reviewed(application(),{findings:[officialFinding('BLOCK')]});assert.equal(a.report.cost_safety_status,'PASS');assert.equal(a.report.overall_status,'BLOCK');assert.equal(gate(a).exit_code,1);
 const b=preflight(opts(fixture('unsafe','CF-SQL-002'))).report;assert.equal(b.cost_safety_status,'BLOCK');assert.equal(b.overall_status,'BLOCK');
});
test('OFF-08 duplicate preserves both origins; advice is not automatically BLOCK',()=>{
 const a={...officialFinding('ADVISORY'),rule_id:'CF-DO-002',origin:'cost_safety'};const b={...a,id:'official-also',origin:'official_best_practices'};assert.equal(deduplicate([a,b])[0].origin,'both');const r=reviewed(application(),{findings:[officialFinding('ADVISORY')]});assert.equal(r.report.overall_status,'PASS');
});
test('OFF-09 official remote examples are context only and never executable',()=>{
 const r=preflight(opts(fixture('safe','CF-DO-001')));assert.ok(r.context.some(c=>c.content.includes('wrangler secret put')));assert.equal(r.report.guarantees.cloud_writes,0);assert.equal(r.report.tests.some(t=>t.command.includes('wrangler')),false);
});
test('OFF-10 static target has evidence; environment and official upgrade need recheck',()=>{
 const root=application({assets:{directory:'public'}});const cfg=json(path.join(root,'wrangler.jsonc'));delete cfg.main;writeJSON(path.join(root,'wrangler.jsonc'),cfg);fs.mkdirSync(path.join(root,'public'));fs.writeFileSync(path.join(root,'public/index.html'),'<h1>static fixture</h1>');const r=preflight({...opts(root),artifact:'public'}).report;assert.equal(r.inventory.static_only,true);assert.ok(r.rules.some(x=>x.status==='not_applicable'&&x.evidence.length));assert.equal(r.official_skills[0].required,true);
 const a=reviewed();const trust=structuredClone(a.trust);trust.official_skills_lock_digest=digest('other-upstream-version');assert.equal(gate({...a,trust}).allowed,false);
});
