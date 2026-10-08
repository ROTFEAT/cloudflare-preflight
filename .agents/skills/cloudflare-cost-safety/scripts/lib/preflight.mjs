import fs from 'node:fs';
import path from 'node:path';
import {spawnSync,execFileSync} from 'node:child_process';
import {SKILL_ROOT,VERSION,asset,json,digest,sha256,snapshot,readSafe,redact,precedence,inside} from './core.mjs';
import {loadConfig,toolVersions} from './config.mjs';
import {analyzeAST} from './ast.mjs';
import {collectSQL} from './sql.mjs';
import {catalog,evaluateRules} from './rules.mjs';
import {resolveOfficial,publicOfficial} from './official.mjs';
import {classifyIntent} from './intent.mjs';
import {validate} from './schema.mjs';

export const defaultPolicy=()=>json(asset('default-policy.json'));
export const toolDigest=()=>snapshot(SKILL_ROOT).digest;
function artifactDigest(root,relative) {
  if(!relative)return null;
  const file=inside(root,relative);
  if(fs.statSync(file).isDirectory()) {const tree=snapshot(file);if(tree.gaps.length)throw new Error('artifact_snapshot_incomplete');return tree.digest;}
  const data=readSafe(root,relative);
  if(!data.includes(0)&&redact(data.toString())!==data.toString())throw new Error('artifact_contains_sensitive_value');
  return sha256(data);
}
export function requiredTests(inventory,sql,policy) {
  const tests=new Set(['bounded-local-probe',...(policy.required_tests||[])]);
  if(inventory.has_do){tests.add('do-lifecycle');tests.add('do-getalarm');}
  if(inventory.bindings.some(b=>b.kind==='queue_consumer')){tests.add('queue-feedback');tests.add('queue-partial');}
  if(sql.queries.length){tests.add('sql-plan');tests.add('sql-rows');}
  if(inventory.entry_points.some(e=>e.type==='scheduled')&&sql.queries.length)tests.add('job-progress');
  if(inventory.bindings.some(b=>b.kind==='kv'))tests.add('kv-pagination');
  if(inventory.bindings.some(b=>b.kind==='r2'))tests.add('r2-frequency');
  return [...tests];
}
export function runLocalProbe(sql,texts,identity,policy) {
  const groups=new Map();
  for(const q of sql.queries.filter(q=>q.text&&!q.statements.every(s=>s.type==='create'))) {
    const schema=sql.schemaFor(q);
    if(!groups.has(schema.key))groups.set(schema.key,{schema:schema.ddl,queries:[]});
    groups.get(schema.key).queries.push({sql:q.text,location:q.location});
  }
  const input={groups:[...groups.values()]};
  const script=path.join(SKILL_ROOT,'scripts/lib/probe.py'),start=performance.now();
  const result=spawnSync('python3',[script,String(policy.local_test_budget.max_memory_mb)],{input:JSON.stringify(input),encoding:'utf8',env:{PATH:'/usr/bin:/bin'},timeout:policy.local_test_budget.max_wall_seconds_per_child*1000,maxBuffer:65536});
  let metrics={};try{metrics=JSON.parse(result.stdout);}catch{}
  return {id:'bounded-local-probe',status:result.error||result.status!==0?'failed':metrics.status==='passed'?'passed':'unsupported',tool_error:!!result.error||result.status!==0,input_digest:identity.digest,command:['python3',script,String(policy.local_test_budget.max_memory_mb)],runner_digest:sha256(fs.readFileSync(script)),duration_ms:Math.round(performance.now()-start),metrics};
}
function validateLocations(evidence,snap) {
  return evidence.every(e=>{
    const text=snap.texts.get(e.path);
    return text!==undefined&&e.start_line>=1&&e.start_line<=text.split('\n').length&&(!e.end_line||e.end_line>=e.start_line&&e.end_line<=text.split('\n').length);
  });
}
function applySemantic(report,review,snap) {
  try{validate('semantic-review',review);}catch(e){report.incomplete.push(e.message);return;}
  if(review.input_digest!==report.deployment_identity.digest){report.incomplete.push('semantic_review_input_mismatch');return;}
  if(new Set(review.rules.map(r=>r.rule_id)).size!==12){report.incomplete.push('semantic_review_missing_or_duplicate_rules');return;}
  if(review.rules.some(r=>!validateLocations(r.evidence,snap))||review.official_skills.some(s=>!validateLocations(s.evidence,snap))||review.findings.some(f=>!validateLocations([f.location],snap))){report.incomplete.push('semantic_review_invalid_source_location');return;}
  for(const rule of report.rules) {
    const reviewed=review.rules.find(r=>r.rule_id===rule.rule_id);
    rule.evidence.push({kind:'semantic_review',reason:reviewed.reason,evidence:reviewed.evidence});
    if(rule.status==='finding')continue;
    if(reviewed.status==='finding'&&!review.findings.some(f=>f.rule_id===rule.rule_id)){report.incomplete.push(`semantic_finding_missing:${rule.rule_id}`);continue;}
    rule.status=reviewed.status;rule.gaps=reviewed.status==='unknown'?rule.gaps.concat({reason:reviewed.reason}):[];
  }
  for(const skill of report.official_skills.filter(s=>s.required)) {
    if(skill.load_status!=='loaded')continue;
    const reviewed=review.official_skills.find(s=>s.name===skill.name);
    const expected=skill.evidence.map(e=>({path:e.path,sha256:e.sha256}));
    if(!reviewed||reviewed.status!=='reviewed'||digest([...reviewed.reviewed_files].sort((a,b)=>a.path.localeCompare(b.path)))!==digest(expected.sort((a,b)=>a.path.localeCompare(b.path)))){report.incomplete.push(`official_semantic_review_missing:${skill.name}`);continue;}
    skill.review_status='reviewed';skill.load_status='reviewed';
    skill.evidence.push({kind:'semantic_review',reason:reviewed.reason,evidence:reviewed.evidence});
    skill.findings=review.findings.filter(f=>f.origin!=='cost_safety'&&f.evidence?.skill===skill.name);
  }
  report.findings=deduplicate([...report.findings,...review.findings]);
  report.tests.push(...review.tests.filter(t=>t.input_digest===report.deployment_identity.digest&&t.id!=='bounded-local-probe'));
  if(review.usage_assessment) {
    const usage=review.usage_assessment;
    if(!validateLocations([...usage.evidence,...usage.enforced_limits.map(l=>l.location)],snap))report.incomplete.push('usage_enforcement_location_invalid');
    else if(usage.classification==='bounded_under_assumptions'&&(Object.entries(usage.vector).some(([dimension,n])=>n===null||n>0&&!usage.enforced_limits.some(l=>l.dimension===dimension&&l.limit===n))||report.coverage.required_tests.some(id=>!report.tests.some(t=>t.id===id&&t.status==='passed'))))report.incomplete.push('bounded_usage_requires_all_units_enforced_and_tests_executed');
    else report.usage_assessment=structuredClone(usage);
  }
  if(report.findings.some(f=>f.status==='BLOCK'))report.usage_assessment.classification='unbounded_path';
  report.review_identity={reviewer:review.reviewer,model:review.model,invocation:review.invocation,reviewed_at:review.reviewed_at,input_digest:review.input_digest};
}
export function deduplicate(findings) {
  const result=[];
  for(const finding of findings) {
    const previous=result.find(f=>f.id===finding.id||(f.location.path===finding.location.path&&f.location.start_line===finding.location.start_line&&(f.rule_id===finding.rule_id||finding.evidence?.cost_rule_id===f.rule_id)));
    if(!previous){result.push(structuredClone(finding));continue;}
    if(previous.origin!==finding.origin)previous.origin='both';
    if(finding.status==='BLOCK')previous.status='BLOCK';
    previous.evidence={...previous.evidence,additional_sources:[...(previous.evidence.additional_sources||[]),finding.evidence]};
  }
  return result;
}
function nativeControls(inventory) {
  const sources=json(asset('sources.json')).sources;
  const definitions=[
    {product:'Workers',control:'cpu_limit',surface:'runtime_configuration',source:'CF-WORKER-LIMIT',scope:'CPU per invocation; not SQL, wait time, cross-event or monthly usage'},
    {product:'Billing',control:'budget_alert',surface:'management_notification',source:'CF-BUDGET',scope:'Notification only; no pause or hard cap'},
    ...(inventory.has_do?[{product:'Durable Objects',control:'deleteAlarm',surface:'object_runtime_api',source:'CF-ALARMS',scope:'Scheduled alarm on one object; not account isolation or cancellation of running work'}]:[]),
    ...(inventory.bindings.some(b=>b.kind.startsWith('queue'))?[{product:'Queues',control:'pause_delivery',surface:'documented_management_control',source:'CF-QUEUE-PAUSE',scope:'Stops consumer delivery; producers and retained messages remain'},{product:'Queues',control:'max_retries_and_DLQ',surface:'consumer_configuration',source:'CF-QUEUE-RETRY',scope:'One message retry lifecycle, not newly sent logical-task messages'}]:[]),
    ...(inventory.bindings.some(b=>b.kind==='d1')?[{product:'D1',control:'query_plan_and_meta',surface:'database_runtime_api',source:'CF-D1-PRICE',scope:'Measure reads/writes, including index writes; not a per-query price ceiling'}]:[]),
    ...(inventory.bindings.some(b=>b.kind==='r2')?[{product:'R2',control:'access_control',surface:'bucket_and_credentials',source:'CF-R2-PRICE',scope:'Public-domain protection does not cover S3 credentials or internal bindings; requests/storage/retrieval remain separate'}]:[])
  ];
  return definitions.map(d=>({product:d.product,plan_backend:'unknown',control:d.control,control_surface:d.surface,scope:d.scope,official_source:sources.find(s=>s.id===d.source)?.url,checked_at:'2026-10-08',version_conditions:'Verify the candidate toolchain, plan and backend',configuration_evidence:'unknown',data_preservation:'unknown',reversible:'unknown',affects_running_tasks:'unknown',covers_new_producers:d.control==='pause_delivery'?false:'unknown',propagation_delay:'unknown',uncovered_paths:['Other entry points','Background tasks','Storage and fixed charges'],manual_verification:['Verify this control against current product documentation and target configuration without executing changes'],execution_status:'NOT_EXECUTED'}));
}
export function aggregate(report) {
  const officialFindings=report.findings.filter(f=>f.origin!=='cost_safety');
  const costFindings=report.findings.filter(f=>f.origin!=='official_best_practices');
  const statuses=fs=>fs.map(f=>f.status).filter(s=>s!=='ADVISORY');
  report.official_best_practices_status=precedence([...statuses(officialFindings),...(report.official_skills.some(s=>s.required&&(s.review_status!=='reviewed'||s.load_status!=='reviewed'))?['INCOMPLETE']:[])]);
  report.cost_safety_status=precedence([...statuses(costFindings),...(report.rules.some(r=>['unknown','not_run'].includes(r.status))?['INCOMPLETE']:[])]);
  const missing=report.coverage.required_tests.filter(id=>!report.tests.some(t=>t.id===id&&t.status==='passed'&&t.input_digest===report.deployment_identity.digest));
  report.coverage.missing_tests=missing;
  report.overall_status=precedence([report.official_best_practices_status,report.cost_safety_status,...(report.tests.some(t=>t.status==='failed'&&!t.tool_error)?['BLOCK']:[]),...(report.incomplete.length||missing.length||report.tool_errors.length?['INCOMPLETE']:[])]);
  report.predeploy_gate_status=report.overall_status==='PASS'?'ALLOW':'DENY';
  return report;
}
export function preflight(options={}) {
  const root=fs.realpathSync(options.root||process.cwd()),policy=options.policy||defaultPolicy();validate('policy',policy);
  const exclude=options.output&&path.resolve(options.output).startsWith(root+path.sep)?[path.relative(root,options.output)]:[];
  const snap=snapshot(root,{exclude:[...exclude,'.agents/skills','.codex/skills']});
  const config=loadConfig(root,options.config,options.environment||'production');
  const ast=analyzeAST(snap.texts,config),sql=collectSQL(ast,snap.texts,config),versions=toolVersions(snap.texts,root,options.wranglerPackage);
  const toolchain=snap.texts.has('cloudflare.config.ts')?'unsupported_cf_cli':config.toolchain;
  const hasDO=config.bindings.some(b=>b.kind==='durable_object')||config.effective.migrations?.some(m=>m.new_classes?.length||m.new_sqlite_classes?.length)||ast.classes.some(c=>/DurableObject|Agent/.test(c.base))||ast.operations.some(o=>o.method==='setAlarm')||ast.imports.some(i=>i.spec==='agents');
  const inventory={application:config.effective.name||null,toolchain,tool_versions:versions,compatibility_date:config.effective.compatibility_date||null,compatibility_flags:config.effective.compatibility_flags||[],has_do:!!hasDO,static_only:config.static_only||false,bindings:config.bindings,entry_points:ast.entries.map(e=>({name:e.name,type:e.entry_type,status:'declared',location:e.location})),environments:config.environments||[],account_state:'unknown_not_accessed',migration_files:sql.migrations};
  const official=resolveOfficial(inventory,options.official||{});
  const incomplete=[...snap.gaps,...config.gaps,...official.gaps].map(g=>`${g.reason}${g.path?`:${g.path}`:g.skill?`:${g.skill}`:''}`);
  let artifact=null;try{artifact=artifactDigest(root,options.artifact);}catch{incomplete.push('artifact_unreadable_or_unsafe');}
  const target={account_id:options.account||config.effective.account_id||null,application:config.effective.name||null,environment:options.environment||'production',action:options.action||'deploy',candidate_version:options.candidateVersion||null};
  if(!target.account_id||!target.application||!config.digest||!artifact)incomplete.push('release_target_or_final_artifact_unresolved');
  if(options.artifact&&config.effective.main) {
    const main=path.posix.normalize(config.effective.main),art=path.posix.normalize(options.artifact);
    if(main!==art&&!main.startsWith(`${art}/`))incomplete.push('final_config_does_not_consume_reviewed_artifact');
  }
  if(config.effective.account_id&&options.account&&config.effective.account_id!==options.account)incomplete.push('account_target_conflicts_with_effective_config');
  if(['promote','rollback'].includes(target.action)&&!target.candidate_version)incomplete.push('candidate_version_required_for_promotion_or_rollback');
  if(!config.static_only&&!config.effective.main)incomplete.push('candidate_runtime_entry_unresolved');
  if(config.effective.main&&!ast.sources.has(path.posix.normalize(config.effective.main)))incomplete.push('candidate_runtime_entry_outside_reviewed_sources');
  if(config.effective.main&&!ast.entries.some(e=>e.file===path.posix.normalize(config.effective.main)))incomplete.push('candidate_handler_dispatch_unresolved');
  if(!options.builder)incomplete.push('builder_identity_unknown');
  if(toolchain==='unsupported_cf_cli')incomplete.push('cf_cli_routed_by_upstream_but_adapter_not_implemented');
  if(toolchain==='wrangler'&&(!versions.wrangler||!versions.wrangler_locked))incomplete.push('Wrangler_installed_or_locked_version_unresolved');
  if(versions.wrangler&&versions.wrangler_locked&&versions.wrangler!==versions.wrangler_locked)incomplete.push('installed_publisher_Wrangler_differs_from_candidate_lock');
  if(config.bindings.some(b=>['workflow','ai','vectorize'].includes(b.kind))||ast.imports.some(i=>/ai-sdk|workers-ai/.test(i.spec)))incomplete.push('P1_billable_product_path_not_implemented');
  const migrationDigest=digest(snap.files.filter(f=>f.path.endsWith('.sql')));
  const identity={schema_version:'1.0',source_snapshot_digest:snap.digest,commit:snap.commit,artifact_digest:artifact,artifact_path:options.artifact||null,effective_config_digest:config.digest,config_path:config.file,target,official_skills_lock_digest:official.lock_digest,policy_digest:digest(policy),rules_digest:digest(catalog()),tool_digest:toolDigest(),toolchain:versions,migration_digest:migrationDigest,builder:options.builder||'unknown'};
  identity.digest=digest(identity);validate('deployment-identity',identity);
  const {results,findings}=evaluateRules(ast,config,sql,snap.texts,policy);
  let scripts={};try{scripts=JSON.parse(snap.texts.get('package.json')||'{}').scripts||{};}catch{incomplete.push('package_json_invalid');}
  const activation=classifyIntent({request:options.intent||'',command:options.command||'',scripts,texts:snap.texts,explicit:!options.command&&!options.intent});
  if(activation.status==='unknown')incomplete.push('release_command_effects_unresolved');
  let changedFiles=[];
  if(options.mode==='diff') {
    if(!options.base||!/^[a-f0-9]{40}$/.test(options.base))incomplete.push('diff_base_commit_unresolved');
    else try{changedFiles=execFileSync('git',['-C',root,'diff','--name-only',options.base,'--'],{encoding:'utf8',timeout:2000}).trim().split('\n').filter(Boolean);}catch{incomplete.push('diff_base_unreadable');}
  }
  const report={schema_version:'1.0',skill_version:VERSION,reviewed_at:new Date().toISOString(),scope:{repository:root,commit:snap.commit,review_mode:options.mode||'full',analysis_scope:'full_local_call_closure_including_configuration',changed_files:changedFiles,files:snap.files,cloud_account_accessed:false},activation:{...activation,expanded:activation.expanded?.map(()=> '[command inspected, values omitted]')},deployment_identity:identity,inventory,execution_graph:ast.graph,official_skills:publicOfficial(official.skills),rules:results,findings,tests:[],native_controls:nativeControls(inventory),coverage:{rules_total:12,rules_evaluated:results.map(r=>r.rule_id),unknown_edges:ast.gaps,sql_gaps:sql.gaps,required_tests:requiredTests(inventory,sql,policy),missing_tests:[],uncovered_products:['AI/external charges','Workflows','DO WebSocket/active duration','R2 object event loops','logs/traces'],deployment_bypasses:['Direct CLI','Cloudflare dashboard','Unverified Workers Builds deployment and preview commands','Independent CI']},usage_assessment:{classification:findings.some(f=>f.status==='BLOCK')?'unbounded_path':'unknown',vector:{events:null,queue_deliveries:null,new_messages:null,sql_rows_read:null,sql_rows_written:null,kv_reads:null,kv_writes:null,kv_lists:null,r2_class_a:null,r2_class_b:null,active_objects:null,environments:null},usd_estimate:null,assumptions:['Declared configuration describes the reviewed artifact; live account state is not inspected'],enforced_limits:[],excluded:['duration','storage','fixed fees','logs/traces','external AI']},approvals:[],incomplete,tool_errors:[],overall_status:'INCOMPLETE',official_best_practices_status:'INCOMPLETE',cost_safety_status:'INCOMPLETE',predeploy_gate_status:'DENY',deployment_gate_coverage:'partial',guarantees:{hard_monthly_cap:false,production_isolation_performed:false,cloud_writes:0},review_identity:null};
  if(options.localTests) {
    const probe=runLocalProbe(sql,snap.texts,identity,policy);report.tests.push(probe);
    if(probe.tool_error)report.tool_errors.push('bounded_local_probe_execution_failed_or_timed_out');
    if(sql.queries.length&&probe.status==='passed'&&probe.metrics.results?.every(r=>r.status==='passed'))report.tests.push({...probe,id:'sql-plan'});
  }
  if(options.review)applySemantic(report,options.review,snap);
  aggregate(report);validate('report',redact(report));
  return {report:redact(report),context:official.context,options:{...options,root,policy},ast,sql};
}
