import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {preflight} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/preflight.mjs';
import {validate} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/schema.mjs';
import {fixture,temp,opts,mockReview,application} from '../helpers.mjs';
import {writeJSON} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {spawnSync} from 'node:child_process';
import {renderReport} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/render.mjs';

test('FORWARD dormant DO and a stub without RPC cannot prove activation',()=>{
  const root=temp();fs.cpSync(fixture('unsafe','CF-DO-001'),root,{recursive:true});
  const file=path.join(root,'main.js'),source=fs.readFileSync(file,'utf8');
  for(const replacement of ['return new Response("idle")','env.TASKS.getByName("shared");return new Response("idle")']) {
    fs.writeFileSync(file,source.replace('await env.TASKS.getByName("shared").activate();return new Response("ok")',replacement));
    const report=preflight(opts(root)).report;
    assert.equal(report.findings.some(f=>f.status==='BLOCK'),false);
    assert.equal(report.rules.find(r=>r.rule_id==='CF-DO-001').status,'unknown');
    assert.notEqual(report.overall_status,'PASS');
  }
});
test('FORWARD a D1 migration cannot establish an uninitialized DO table',()=>{
  const root=temp();fs.cpSync(fixture('unsafe','CF-DO-001'),root,{recursive:true});
  const file=path.join(root,'main.js');
  fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, status TEXT, done INTEGER, value INTEGER)");',''));
  fs.mkdirSync(path.join(root,'migrations'));
  fs.writeFileSync(path.join(root,'migrations/0001.sql'),'CREATE TABLE jobs(id INTEGER PRIMARY KEY);');
  const report=preflight(opts(root)).report;
  assert.equal(report.findings.some(f=>f.rule_id==='CF-DO-001'&&f.status==='BLOCK'),false);
  assert.equal(report.rules.find(r=>r.rule_id==='CF-DO-001').status,'unknown');
  assert.equal(report.tests.find(t=>t.id==='bounded-local-probe').status,'unsupported');
});
test('FORWARD Python structural probe actually compiles SELECT and UPDATE; graph IDs are unique',()=>{
  const report=preflight(opts(fixture('unsafe','CF-SQL-002'))).report;
  const probe=report.tests.find(t=>t.id==='bounded-local-probe');
  assert.equal(probe.status,'passed');
  assert.ok(probe.metrics.results.some(r=>r.explain_query_plan.some(p=>p.includes('SCAN jobs'))));
  assert.equal(probe.metrics.billing_metrics,null);
  assert.equal(new Set(report.execution_graph.nodes.map(n=>n.id)).size,report.execution_graph.nodes.length);
});
test('FORWARD missing runner evidence can truthfully be null and never counts as passed',()=>{
  const root=application(),initial=preflight(opts(root)).report,review=mockReview(initial);
  review.tests=[{id:'bounded-local-probe',status:'not_run',input_digest:initial.deployment_identity.digest,command:null,runner_digest:null,duration_ms:null,metrics:{reason:'unavailable'}}];
  validate('semantic-review',review);
  const report=preflight({...opts(root),localTests:false,review}).report;
  assert.notEqual(report.overall_status,'PASS');
  assert.ok(report.coverage.missing_tests.includes('bounded-local-probe'));
});
test('FORWARD dead helpers named fetch are not Worker entries',()=>{
  const root=application({d1_databases:[{binding:'DB',database_id:'synthetic'}]});
  fs.appendFileSync(path.join(root,'main.js'),'function fetch(req,env){return env.DB.prepare("UPDATE jobs SET value=1").run()}');
  const report=preflight(opts(root)).report;assert.equal(report.inventory.entry_points.length,1);assert.equal(report.findings.some(f=>f.status==='BLOCK'),false);
});
test('FORWARD named production environment and config-relative main resolve actual bytes',()=>{
  const root=application();fs.mkdirSync(path.join(root,'config'));writeJSON(path.join(root,'config/wrangler.jsonc'),{name:'default-name',account_id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',main:'../main.js',compatibility_date:'2026-10-08',env:{production:{name:'actual-production'}}});
  const report=preflight({...opts(root),config:'config/wrangler.jsonc',environment:'production'}).report;
  assert.equal(report.inventory.application,'actual-production');assert.ok(report.inventory.entry_points.length);assert.equal(report.incomplete.some(s=>s.includes('entry_outside')),false);
});
test('FORWARD ORM and configured P1 products remain explicit gaps',()=>{
  const root=application({d1_databases:[{binding:'DB',database_id:'synthetic'}],ai:{binding:'AI'}});
  fs.writeFileSync(path.join(root,'main.js'),'import {drizzle} from "drizzle-orm/d1";export default {async fetch(req,env){return Response.json(await drizzle(env.DB).query.jobs.findMany())}};');
  const report=preflight(opts(root)).report;for(const id of ['CF-SQL-001','CF-SQL-002'])assert.equal(report.rules.find(r=>r.rule_id===id).status,'unknown');assert.ok(report.incomplete.includes('P1_billable_product_path_not_implemented'));
});
test('FORWARD unknown usage cannot be labelled bounded and passed test evidence cannot be null',()=>{
  const root=application(),initial=preflight(opts(root)).report,review=mockReview(initial);
  review.usage_assessment={...initial.usage_assessment,scope:'per logical job',classification:'bounded_under_assumptions',evidence:[{path:'main.js',start_line:1}]};
  const report=preflight({...opts(root),review}).report;assert.ok(report.incomplete.includes('bounded_usage_requires_all_units_enforced_and_tests_executed'));assert.notEqual(report.overall_status,'PASS');
  delete review.usage_assessment;review.tests=[{id:'sql-rows',status:'passed',input_digest:initial.deployment_identity.digest,command:null,runner_digest:null,duration_ms:null,metrics:{}}];assert.throws(()=>validate('semantic-review',review));
});
test('FORWARD nullable not_run evidence renders and the actual CLI returns INCOMPLETE',()=>{
  const root=application({durable_objects:{bindings:[{name:'TASKS',class_name:'Missing'}]}}),initial=preflight(opts(root)).report,review=mockReview(initial);
  review.tests=review.tests.map(t=>t.id==='do-lifecycle'?{...t,status:'not_run',command:null,runner_digest:null,duration_ms:null}:t);
  const report=preflight({...opts(root),review}).report;
  assert.match(renderReport(report),/do-lifecycle: not_run \(unknown ms\); unknown/);
  const record=path.join(temp(),'review.json');writeJSON(record,review);
  const cli=spawnSync(process.execPath,[path.resolve('.agents/skills/cloudflare-cost-safety/scripts/cli.mjs'),'preflight','--root',root,'--artifact','main.js','--builder',opts(root).builder,'--local-tests','--review',record],{encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH}});
  assert.equal(cli.status,2,cli.stdout+cli.stderr);assert.match(fs.readFileSync(path.join(root,'.cost-safety/report.md'),'utf8'),/INCOMPLETE/);
});
test('FORWARD untrusted output symlink cannot overwrite another file',()=>{
  const root=application(),external=temp(),victim=path.join(external,'victim');fs.writeFileSync(victim,'original');fs.mkdirSync(path.join(root,'.cost-safety'));fs.symlinkSync(victim,path.join(root,'.cost-safety/report.json'));
  const cli=spawnSync(process.execPath,[path.resolve('.agents/skills/cloudflare-cost-safety/scripts/cli.mjs'),'preflight','--root',root,'--artifact','main.js','--builder',opts(root).builder],{encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH}});
  assert.equal(cli.status,3);assert.equal(fs.readFileSync(victim,'utf8'),'original');assert.match(cli.stderr,/output_symlink_rejected/);
});
