import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {preflight,toolDigest,defaultPolicy} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/preflight.mjs';
import {json,digest,writeJSON} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {signEnvelope} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/gate.mjs';

export const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'cf-cost-safety-'));
export function application(extra={}) {
  const root=temp();
  fs.writeFileSync(path.join(root,'main.js'),'export default {fetch(){return new Response("fixture")}};\n');
  writeJSON(path.join(root,'wrangler.jsonc'),{name:'synthetic-app',account_id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',main:'main.js',compatibility_date:'2026-10-08',...extra});
  writeJSON(path.join(root,'package-lock.json'),{lockfileVersion:3,packages:{'node_modules/wrangler':{version:'4.148.0'}}});
  return root;
}
export function fixture(kind,id) {return path.resolve(`tests/fixtures/${kind}/${id}`);}
export const opts=root=>({root,artifact:'main.js',builder:'synthetic-direct-js@1',localTests:true});
export function mockBounds(report) {
  // Orchestration data only. These values are not observed application bounds.
  return {paths:report.coverage.execution_bounds.map(p=>({path_id:p.path_id,
    scope:p.requires_cumulative_bound?'logical_job':'invocation',max_events:4,
    work_limits:{synthetic_operations:4},reason:'MOCK_NO_MODEL_CALL: test-double assumption, not an application proof',
    enforcement:[p.location],observations:p.required_scenarios.map(s=>({scenario:s,case:'Synthetic orchestration record; not executed application work',events:1,work:{synthetic_operations:1}}))}))};
}
export function mockReview(report,{findings=[]}={}) {
  // This is a mock semantic reviewer, never evidence of an actual Agent review.
  const evidence=[{path:'main.js',start_line:1}];
  return {schema_version:'1.0',input_digest:report.deployment_identity.digest,reviewer:'synthetic-test-reviewer',model:'MOCK_NO_MODEL_CALL',invocation:'deterministic-test-double',reviewed_at:new Date().toISOString(),rules:report.rules.map(r=>({rule_id:r.rule_id,status:r.status==='not_applicable'?'not_applicable':r.status==='finding'?'finding':'pass',reason:'Synthetic test assumption; not a real repository review',evidence})),official_skills:report.official_skills.filter(s=>s.required).map(s=>({name:s.name,status:'reviewed',reviewed_files:s.evidence.filter(e=>e.operation==='read').map(e=>({path:e.path,sha256:e.sha256})),reason:'Test double confirms orchestration; this is not Agent coverage',evidence})),tests:report.coverage.required_tests.filter(id=>!report.tests.some(t=>t.id===id)).map(id=>({id,status:'passed',input_digest:report.deployment_identity.digest,command:['mock-local-test',id],runner_digest:digest('synthetic-runner'),duration_ms:1,metrics:id==='execution-bounds'?mockBounds(report):{synthetic_test_double:true}})),findings};
}
export function reviewed(root=application(),extra={}) {
  const options={...opts(root),...extra.options};
  const initial=preflight(options).report;
  const semantic=mockReview(initial,extra);
  const report=preflight({...options,review:semantic}).report;
  const keys=crypto.generateKeyPairSync('ed25519');
  const signer={privateKey:keys.privateKey,keyId:'ephemeral-fixture-key',origin:'synthetic-tests',runId:crypto.randomUUID()};
  const trust={schema_version:'1.0',keys:[{id:signer.keyId,public_key:keys.publicKey.export({type:'spki',format:'pem'}),roles:['review','approval'],origins:[signer.origin]}],official_skills_lock_digest:report.deployment_identity.official_skills_lock_digest,policy_digest:digest(defaultPolicy()),tool_digest:toolDigest(),max_age_hours:24};
  return {root,options,report,semantic,signer,trust,envelope:signEnvelope(report,signer)};
}
export function officialFinding(status='REVIEW') {return {id:'official-synthetic-finding',rule_id:null,origin:'official_best_practices',status,severity:status==='BLOCK'?'high':'low',confidence:'synthetic-only',location:{path:'main.js',start_line:1},summary:'Synthetic official review finding',execution_path:['fetch'],usage_assessment:{classification:'unknown',units:['Worker invocations']},evidence:{skill:'workers-best-practices',section:'Runtime patterns'},recommendation:'Review the synthetic tradeoff'};}
