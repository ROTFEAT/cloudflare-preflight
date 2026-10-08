import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {preflight} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/preflight.mjs';
import {catalog} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/rules.mjs';
import {fixture,opts} from '../helpers.mjs';

for(const rule of catalog().rules)for(const kind of ['unsafe','safe','unknown'])test(`${rule.id} ${kind}`,()=>{
 const r=preflight(opts(fixture(kind,rule.id))).report;
 const result=r.rules.find(x=>x.rule_id===rule.id);
 if(kind==='unsafe') {
  const f=r.findings.find(f=>f.rule_id===rule.id&&f.status==='BLOCK');assert.ok(f,JSON.stringify(result));
  assert.equal(f.origin,'cost_safety');assert.ok(f.evidence.ast);assert.ok(f.execution_path.length);
  const lines=fs.readFileSync(`${fixture(kind,rule.id)}/${f.location.path}`,'utf8').split('\n');assert.ok(f.location.start_line>=1&&f.location.start_line<=lines.length);
  assert.equal(r.overall_status,'BLOCK');
 } else if(kind==='safe')assert.equal(r.findings.filter(f=>f.status==='BLOCK').length,0,JSON.stringify(r.findings));
 else {assert.equal(result.status,'unknown');assert.ok(result.gaps.length);assert.notEqual(r.overall_status,'PASS');}
 assert.equal(r.guarantees.cloud_writes,0);
});
