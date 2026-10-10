import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {canonical,digest,precedence,redact} from './core.mjs';
import {validate} from './schema.mjs';
import {preflight,aggregate,toolDigest,defaultPolicy} from './preflight.mjs';

export function signEnvelope(payload,{privateKey,keyId,origin,runId}) {
  if(!keyId||!origin||!runId)throw new Error('trusted_run_identity_required');
  const signed={schema_version:'1.0',key_id:keyId,origin,run_id:runId,payload};
  return {...signed,signature:crypto.sign(null,Buffer.from(canonical(signed)),privateKey).toString('base64')};
}
export function verifyEnvelope(envelope,trust,role='review') {
  if(!envelope||envelope.schema_version!=='1.0'||!envelope.signature||!envelope.run_id)throw new Error('unsigned_or_malformed_evidence');
  const key=trust.keys.find(k=>k.id===envelope.key_id&&k.roles.includes(role)&&k.origins.includes(envelope.origin));
  if(!key)throw new Error('untrusted_evidence_origin');
  const {signature,...signed}=envelope;
  if(!crypto.verify(null,Buffer.from(canonical(signed)),key.public_key,Buffer.from(signature,'base64')))throw new Error('invalid_evidence_signature');
  return envelope.payload;
}
function recent(date,hours,now) {
  const parsed=Date.parse(date);return Number.isFinite(parsed)&&parsed<=now+60000&&now-parsed<=hours*3600000;
}
export function verifyApprovals(report,envelopes,trust,now=Date.now()) {
  const reviews=report.findings.filter(f=>f.status==='REVIEW');
  const approved=new Set(),records=[];
  for(const envelope of envelopes) {
    const approval=verifyEnvelope(envelope,trust,'approval');validate('approval',approval);
    if(approval.input_digest!==report.deployment_identity.digest||!Number.isFinite(Date.parse(approval.expires_at))||Date.parse(approval.expires_at)<=now)throw new Error('approval_expired_or_wrong_scope');
    for(const id of approval.finding_ids) {
      if(!reviews.some(f=>f.id===id))throw new Error('approval_may_only_resolve_REVIEW');
      approved.add(id);
    }
    records.push({...approval,key_id:envelope.key_id,origin:envelope.origin,run_id:envelope.run_id});
  }
  if(reviews.some(f=>!approved.has(f.id)))return {allowed:false,records};
  return {allowed:true,records};
}
export function gate({envelope,trust,approvals=[],options,now=Date.now()}) {
  try {
    validate('trust',trust);
    const report=verifyEnvelope(envelope,trust);validate('report',report);
    const expectedRules=new Set(options?.catalogIds||['CF-DO-001','CF-DO-002','CF-DEP-001','CF-SQL-001','CF-SQL-002','CF-JOB-001','CF-Q-001','CF-Q-002','CF-KV-001','CF-R2-001','CF-HTTP-001','CF-SAFE-001']);
    if(report.rules.length!==12||new Set(report.rules.map(r=>r.rule_id)).size!==12||report.rules.some(r=>!expectedRules.has(r.rule_id)))throw new Error('missing_or_duplicate_rules');
    if(!report.review_identity||report.review_identity.input_digest!==report.deployment_identity.digest)throw new Error('semantic_reviewer_not_run');
    const maxAge=Math.min(trust.max_age_hours,(options?.policy||defaultPolicy()).max_evidence_age_hours);
    if(!recent(report.reviewed_at,maxAge,now)||!recent(report.review_identity.reviewed_at,maxAge,now))throw new Error('review_expired_or_future');
    if(trust.tool_digest!==toolDigest()||trust.tool_digest!==report.deployment_identity.tool_digest)throw new Error('untrusted_or_changed_verifier');
    if(trust.official_skills_lock_digest!==report.deployment_identity.official_skills_lock_digest||trust.policy_digest!==report.deployment_identity.policy_digest)throw new Error('unapproved_policy_or_official_lock');
    // Recompute from actual bytes and explicit publisher target; never use the
    // report's own target as the publisher's target, or a source commit alone.
    const analysis=preflight({...options,review:undefined,localTests:true}),current=analysis.report;
    if(current.deployment_identity.digest!==report.deployment_identity.digest)throw new Error('release_identity_changed');
    if(current.overall_status==='BLOCK')return {allowed:false,exit_code:1,status:'DENY',reason:'current_static_or_local_test_BLOCK',report:current};
    if(current.tool_errors.length)return {allowed:false,exit_code:3,status:'DENY',reason:'current_tool_execution_error',report:current};
    const probe=current.tests.find(t=>t.id==='bounded-local-probe');
    if(probe?.status!=='passed'||!report.tests.some(t=>t.id==='bounded-local-probe'&&t.status==='passed'&&t.runner_digest===probe.runner_digest))throw new Error('current_mandatory_probe_not_completed');
    if(report.tests.some(t=>t.status==='passed'&&(!Array.isArray(t.command)||!t.command.length||!/^[a-f0-9]{64}$/.test(t.runner_digest||'')||!Number.isFinite(t.duration_ms)||t.duration_ms<0)))throw new Error('passed_test_record_incomplete');
    if(current.incomplete.length)throw new Error('current_required_inputs_incomplete');
    if(digest([...current.coverage.required_tests].sort())!==digest([...report.coverage.required_tests].sort()))throw new Error('required_test_set_changed_or_forged');
    if(digest(current.coverage.execution_bounds)!==digest(report.coverage.execution_bounds))throw new Error('execution_bounds_set_changed_or_forged');
    if(report.official_skills.length!==current.official_skills.length||new Set(report.official_skills.map(s=>s.name)).size!==current.official_skills.length)throw new Error('official_dependency_set_changed_or_forged');
    for(const expected of current.official_skills) {
      const actual=report.official_skills.find(s=>s.name===expected.name);
      if(!actual||actual.required!==expected.required||actual.applies!==expected.applies||actual.required&&(actual.content_digest!==expected.content_digest||actual.revision!==expected.revision))throw new Error('official_applicability_or_content_forged');
    }
    if(report.official_skills.some(s=>s.required&&(s.load_status!=='reviewed'||s.review_status!=='reviewed'||!s.evidence.some(e=>e.kind==='semantic_review'))))throw new Error('official_review_missing');
    if(report.rules.some(r=>r.status==='not_run'||r.status==='unknown'||!r.evidence.length))throw new Error('required_rule_not_completed');
    if(report.rules.some(r=>r.status==='finding'&&!report.findings.some(f=>f.rule_id===r.rule_id)))throw new Error('rule_finding_missing');
    const computed=aggregate(structuredClone(report),analysis.ast.sources);
    if(computed.overall_status!==report.overall_status)throw new Error('forged_summary_status');
    if(computed.overall_status==='BLOCK')return {allowed:false,exit_code:1,status:'DENY',reason:'BLOCK_is_not_approvable',report:computed};
    if(computed.tool_errors.length)return {allowed:false,exit_code:3,status:'DENY',reason:'recorded_tool_execution_error',report:computed};
    if(computed.overall_status==='INCOMPLETE'||computed.tool_errors.length)throw new Error('required_evidence_incomplete');
    const approved=verifyApprovals(report,approvals,trust,now);
    if(!approved.allowed)throw new Error('REVIEW_requires_valid_approval');
    computed.approvals=approved.records;
    computed.predeploy_gate_status=computed.overall_status==='REVIEW'?'ALLOW_WITH_APPROVAL':'ALLOW';
    return {allowed:true,exit_code:0,status:computed.predeploy_gate_status,reason:'trusted_evidence_and_current_release_match',artifact:options.artifact,identity:computed.deployment_identity,report:redact(computed)};
  } catch(e) {return {allowed:false,exit_code:2,status:'DENY',reason:e.message};}
}
