import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {preflight} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/preflight.mjs';
import {gate,signEnvelope} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/gate.mjs';
import {renderReport} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/render.mjs';
import {application,fixture,opts,mockReview,reviewed} from '../helpers.mjs';

function omitCheck(root,id) {
  const options=opts(root),initial=preflight(options).report,review=mockReview(initial);
  assert.ok(initial.coverage.required_tests.includes(id));
  review.tests=review.tests.filter(t=>t.id!==id);
  const report=preflight({...options,review}).report;
  assert.ok(report.coverage.missing_tests.includes(id));
  assert.equal(report.overall_status,'INCOMPLETE');
  assert.equal(report.predeploy_gate_status,'DENY');
  return report;
}

test('DELAY reachable alarm work cannot pass without time-boundary and stop evidence',()=>{
  const root=fixture('safe','CF-DO-001');
  omitCheck(root,'do-time-boundaries');
  omitCheck(root,'background-stop');
});

test('DELAY missing application test evidence and a forged required set deny the signed gate',()=>{
  const candidate=reviewed(fixture('safe','CF-DO-001'));
  assert.equal(gate(candidate).allowed,true);
  for(const removeRequirement of [false,true]) {
    const report=structuredClone(candidate.report);
    report.tests=report.tests.filter(t=>t.id!=='do-time-boundaries');
    if(removeRequirement)report.coverage.required_tests=report.coverage.required_tests.filter(id=>id!=='do-time-boundaries');
    const result=gate({...candidate,envelope:signEnvelope(report,candidate.signer)});
    assert.equal(result.allowed,false);
    assert.equal(result.reason,removeRequirement?'required_test_set_changed_or_forged':'forged_summary_status');
  }
});

test('STOP Cron and Queue consumers require a bounded stop test',()=>{
  const cron=application();
  fs.writeFileSync(path.join(cron,'main.js'),'export default {scheduled(){return fetch("https://batch.example.invalid/run")}};');
  const report=omitCheck(cron,'background-stop');
  assert.equal(report.coverage.required_tests.includes('origin-access'),false);
  const queue=application({queues:{consumers:[{queue:'jobs'}]}});
  fs.writeFileSync(path.join(queue,'main.js'),'export default {queue(batch){for(const message of batch.messages)message.ack()}};');
  omitCheck(queue,'background-stop');
});

test('ORIGIN a public proxy through an imported helper needs direct-origin evidence',()=>{
  const root=application({workers_dev:true,vars:{EDGE_RATE_LIMIT:'declared-only'}});
  fs.writeFileSync(path.join(root,'main.js'),'import {forward} from "./proxy.js";export default {fetch(request){return forward(request)}};');
  fs.writeFileSync(path.join(root,'proxy.js'),'export function forward(request){return fetch("https://paid.example.invalid/api",request)}');
  const report=omitCheck(root,'origin-access');
  assert.ok(report.coverage.unknown_edges.some(g=>g.path==='proxy.js'&&g.reason==='external_or_dynamic_endpoint'));
  assert.equal(report.native_controls.every(c=>c.execution_status==='NOT_EXECUTED'),true);
});

test('ORIGIN a dynamic request target requires evidence without guessing its provider',()=>{
  const root=application();
  fs.writeFileSync(path.join(root,'main.js'),'export default {fetch(request){return fetch(new URL(request.url).searchParams.get("target"))}};');
  omitCheck(root,'origin-access');
});

test('SCOPE dead alarm and external-fetch helpers do not add application requirements',()=>{
  const root=application();
  fs.appendFileSync(path.join(root,'main.js'),'\nfunction unused(ctx){ctx.storage.setAlarm(Date.now());return fetch("https://unused.example.invalid/")}');
  const report=preflight(opts(root)).report;
  for(const id of ['do-time-boundaries','background-stop','origin-access'])assert.equal(report.coverage.required_tests.includes(id),false);
});

test('SCOPE an actual lexical fetch helper and a service binding are not unresolved public origins',()=>{
  const local=application();
  fs.writeFileSync(path.join(local,'main.js'),'function fetch(){return new Response("local")}export default {fetch:request=>fetch(request)};');
  const service=application({services:[{binding:'INTERNAL',service:'internal-worker'}]});
  fs.writeFileSync(path.join(service,'main.js'),'export default {fetch(request,env){return env.INTERNAL.fetch(request)}};');
  for(const root of [local,service])assert.equal(preflight(opts(root)).report.coverage.required_tests.includes('origin-access'),false);
});

test('REPORT separates code evidence, unknown usage and unverified cloud controls',()=>{
  const report=preflight(opts(application())).report;
  report.usage_assessment.scope='per synthetic logical task';
  report.usage_assessment.vector.events=4;
  report.usage_assessment.enforced_limits=[{dimension:'events',limit:4,scope:'per synthetic logical task',location:{path:'main.js',start_line:1}}];
  const text=renderReport(report);
  assert.match(text,/Work bound:\*\* unknown/);
  assert.match(text,/events <= 4 \(per synthetic logical task; main\.js:1\)/);
  assert.match(text,/sql_rows_read=unknown/);
  assert.equal(text.includes('sql_rows_read=0'),false);
  assert.match(text,/Cloud controls:\*\* NOT VERIFIED/);
  assert.ok(text.indexOf('## Review summary')<text.indexOf('## Official context'));
});
