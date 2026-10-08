import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {controlledRelease} from '../../scripts/release.mjs';
import {writeJSON} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {reviewed,temp} from '../helpers.mjs';

function setup(){const r=reviewed(),external=temp();writeJSON(path.join(external,'trust.json'),r.trust);writeJSON(path.join(external,'attestation.json'),r.envelope);return {...r,request:{...r.options,environment:'production',trust:path.join(external,'trust.json'),attestation:path.join(external,'attestation.json')}};}
test('RELEASE failed gate invokes the independent publisher zero times',async()=>{
  const r=setup();fs.appendFileSync(path.join(r.root,'main.js'),'// source changed');let calls=0;
  const result=await controlledRelease(r.request,()=>calls++);assert.equal(result.allowed,false);assert.equal(result.publisher_calls,0);assert.equal(calls,0);
});
test('RELEASE hands the same verified bytes to a mock publisher without rebuilding',async()=>{
  const r=setup(),original=fs.readFileSync(path.join(r.root,'main.js'));let calls=0;
  const result=await controlledRelease(r.request,handoff=>{
    calls++;assert.notEqual(handoff.stage,r.root);assert.equal(handoff.rebuilt,false);
    fs.writeFileSync(path.join(r.root,'main.js'),'unreviewed newer source');
    assert.deepEqual(fs.readFileSync(path.join(handoff.stage,handoff.artifact_path)),original);
    assert.equal(fs.statSync(path.join(handoff.stage,handoff.artifact_path)).mode&0o222,0);
    assert.equal(handoff.identity.digest,r.report.deployment_identity.digest);
  });
  assert.equal(result.allowed,true,JSON.stringify(result));assert.equal(calls,1);assert.equal(result.publisher_calls,1);
});
test('RELEASE refuses inherited deployment credentials before reading candidate code',async()=>{
  const r=setup(),previous=process.env.CLOUDFLARE_API_TOKEN;process.env.CLOUDFLARE_API_TOKEN='SYNTHETIC_CANARY_NOT_REAL';
  try{await assert.rejects(controlledRelease(r.request,()=>assert.fail('must not publish')),/analyzer_must_not_inherit/);}finally{if(previous===undefined)delete process.env.CLOUDFLARE_API_TOKEN;else process.env.CLOUDFLARE_API_TOKEN=previous;}
});
test('RELEASE awaits async publisher failures and rejects mutated staging',async()=>{
  const r=setup();await assert.rejects(controlledRelease(r.request,async()=>{throw new Error('synthetic publisher failure');}),/synthetic publisher failure/);
  await assert.rejects(controlledRelease(r.request,handoff=>{const file=path.join(handoff.stage,handoff.artifact_path);fs.chmodSync(file,0o600);fs.writeFileSync(file,'changed');}),/publisher_modified_staged_bytes/);
});
