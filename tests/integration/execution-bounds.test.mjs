import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {preflight} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/preflight.mjs';
import {gate,signEnvelope} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/gate.mjs';
import {application,fixture,opts,mockReview,reviewed} from '../helpers.mjs';

test('BOUNDS discovers renamed local helpers and initialization, without incident input',()=>{
  const root=application({kv_namespaces:[{binding:'CACHE',id:'test'}]});
  fs.writeFileSync(path.join(root,'main.js'),'import {probe} from "./helper.js";export default {fetch(request,env){return probe(env)}};');
  fs.writeFileSync(path.join(root,'helper.js'),'export function probe(env){return env.CACHE.get("value")}');
  const {report}=preflight(opts(root));
  assert.ok(report.coverage.required_tests.includes('execution-bounds'));
  const requirement=report.coverage.execution_bounds.find(p=>p.entry_type==='fetch');
  assert.ok(requirement.operation_ids.length);
  assert.equal(requirement.requires_cumulative_bound,false);
  assert.ok(requirement.required_scenarios.includes('amplification'));
});

test('BOUNDS derives cumulative and fault obligations for Alarm, Cron, Queue and timers',()=>{
  const roots=[fixture('safe','CF-DO-002'),application(),application({queues:{consumers:[{queue:'jobs'}]}}),application({r2_buckets:[{binding:'BUCKET',bucket_name:'test'}]})];
  fs.writeFileSync(path.join(roots[1],'main.js'),'export default {scheduled(){return fetch("https://example.invalid/job")}};');
  fs.writeFileSync(path.join(roots[2],'main.js'),'export default {queue(batch){for(const message of batch.messages)message.ack()}};');
  fs.writeFileSync(path.join(roots[3],'main.js'),'import {env} from "cloudflare:workers";setInterval(()=>env.BUCKET.put("state","value"),900000);export default {fetch(){return new Response("ok")}};');
  for(const root of roots){const {report}=preflight(opts(root));assert.ok(report.coverage.execution_bounds.some(p=>p.requires_cumulative_bound&&p.required_scenarios.includes('exhaustion')&&p.required_scenarios.includes('stop')));}
  const queue=preflight(opts(roots[2])).report.coverage.execution_bounds[0];
  assert.ok(queue.required_scenarios.includes('partial_failure'));
});

test('BOUNDS ordinary finite queries need scope evidence, dead helpers do not',()=>{
  const root=application();
  fs.appendFileSync(path.join(root,'main.js'),'function unused(env){while(true)env.BUCKET.put("x","x")}');
  let report=preflight(opts(root)).report;
  assert.equal(report.coverage.execution_bounds.length,0);
  assert.equal(report.coverage.required_tests.includes('execution-bounds'),false);
  fs.writeFileSync(path.join(root,'main.js'),'function recurse(){return recurse()}export default {fetch(){return recurse()}};');
  report=preflight(opts(root)).report;
  assert.ok(report.coverage.execution_bounds.some(p=>p.requires_cumulative_bound));
});

test('BOUNDS a passed label with no path metrics remains incomplete',()=>{
  const options=opts(fixture('safe','CF-DO-002')),initial=preflight(options).report,review=mockReview(initial);
  review.tests.find(t=>t.id==='execution-bounds').metrics={};
  const {report}=preflight({...options,review});
  assert.equal(report.overall_status,'INCOMPLETE');
  assert.ok(report.coverage.execution_bounds_gaps.includes('execution_bounds:invalid_test_metrics'));
});

test('BOUNDS missing paths, scenarios, units and exceeded limits cannot pass',()=>{
  const options=opts(fixture('safe','CF-DO-002')),initial=preflight(options).report;
  const changes=[
    m=>m.paths.pop(),
    m=>m.paths[0].observations=m.paths[0].observations.filter(o=>o.scenario!=='no_progress'),
    m=>m.paths[0].observations[0].work={},
    m=>m.paths[0].observations[0].work.synthetic_operations=5,
    m=>m.paths[0].observations[0].events=5,
    m=>m.paths[0].enforcement=[{path:'not-in-source.js',start_line:1}],
    m=>m.paths[0].scope='invocation',
    m=>{m.paths[0].scope='time_window';}
  ];
  for(const change of changes){const review=mockReview(initial);change(review.tests.find(t=>t.id==='execution-bounds').metrics);const {report}=preflight({...options,review});assert.equal(report.predeploy_gate_status,'DENY');assert.ok(report.coverage.execution_bounds_gaps.length);}
});

test('BOUNDS trusted orchestration accepts finite logical jobs and bounded recurring windows',()=>{
  const candidate=reviewed(fixture('safe','CF-DO-002'));
  assert.equal(gate(candidate).allowed,true);
  const report=structuredClone(candidate.report);
  for(const proof of report.tests.find(t=>t.id==='execution-bounds').metrics.paths){proof.scope='time_window';proof.window_ms=3600000;}
  assert.equal(gate({...candidate,envelope:signEnvelope(report,candidate.signer)}).allowed,true);
});

test('BOUNDS the independent gate recomputes obligations and validates signed metrics',()=>{
  const candidate=reviewed(fixture('safe','CF-DO-002'));
  const changes=[r=>r.coverage.execution_bounds=[],r=>r.tests.find(t=>t.id==='execution-bounds').metrics.paths.pop(),r=>r.tests.find(t=>t.id==='execution-bounds').metrics.paths[0].enforcement=[{path:'main.js',start_line:9999}]];
  for(const change of changes){const report=structuredClone(candidate.report);change(report);assert.equal(gate({...candidate,envelope:signEnvelope(report,candidate.signer)}).allowed,false);}
});
