#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {json,writeJSON,safeWrite,exitCode,redact,SKILL_ROOT,VERSION,DISPLAY_VERSION} from './lib/core.mjs';
import {preflight,toolDigest,defaultPolicy} from './lib/preflight.mjs';
import {gate,signEnvelope} from './lib/gate.mjs';
import {renderReport} from './lib/render.mjs';
import {classifyIntent} from './lib/intent.mjs';
import {validate} from './lib/schema.mjs';

const [action='help',...args]=process.argv.slice(2),flags={};
function parseFlags(){for(let i=0;i<args.length;i++) {
  if(!args[i].startsWith('--'))throw new Error('named_options_required');
  const key=args[i].slice(2);flags[key]=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:true;
}}
const options=()=>({root:flags.root||process.cwd(),config:flags.config,environment:flags.env||'production',account:flags.account,artifact:flags.artifact,action:flags.action||'deploy',candidateVersion:flags['candidate-version'],builder:flags.builder,wranglerPackage:flags['wrangler-package'],mode:flags.mode||'full',base:flags.base,command:flags.command,intent:flags.intent,output:flags.output||path.join(flags.root||process.cwd(),'.cost-safety'),policy:flags.policy?json(flags.policy):defaultPolicy(),localTests:flags['local-tests']===true,review:flags.review?json(flags.review):undefined});
function outputReport(result) {
  const dir=path.resolve(options().output);
  const markdown=renderReport(result.report);
  writeJSON(path.join(dir,'report.json'),result.report);
  safeWrite(path.join(dir,'report.md'),markdown);
  // Explicit context packet contains actual pinned content; repository prose is
  // not converted into executable instructions or shell commands.
  writeJSON(path.join(dir,'official-context.json'),result.context);
  process.stdout.write(`${result.report.overall_status}: ${path.join(dir,'report.md')}\n`);
}
async function main() {
  if(action==='--version'){process.stdout.write(`${VERSION}\n`);return;}
  if(action==='version'){process.stdout.write(JSON.stringify({name:'cloudflare-cost-safety',version:VERSION,display_version:DISPLAY_VERSION,tag:`v${DISPLAY_VERSION}`},null,2)+'\n');return;}
  if(action==='preflight'&&!flags['internal-worker']) {
    // Parent watchdog can interrupt parser crashes, sync loops and microtasks.
    // No production environment is inherited by the analysis worker.
    const child=spawn(process.execPath,['--max-old-space-size=384',fileURLToPath(import.meta.url),'preflight',...args,'--internal-worker'],{env:{PATH:process.env.PATH,HOME:'/nonexistent',WRANGLER_SEND_METRICS:'false'},stdio:['ignore','inherit','inherit'],detached:true});
    let expired=false;const timer=setTimeout(()=>{expired=true;try{process.kill(-child.pid,'SIGKILL');}catch{}},30000);
    await new Promise(resolve=>child.on('exit',code=>{clearTimeout(timer);process.exitCode=expired?3:code??3;resolve();}));return;
  }
  if(action==='preflight') {const result=preflight(options());outputReport(result);process.exitCode=exitCode(result.report);return;}
  if(action==='inventory'||action==='collect-candidates'||action==='resolve-official-skills') {
    const result=preflight(options());
    process.stdout.write(JSON.stringify(action==='inventory'?result.report.inventory:action==='collect-candidates'?{rules:result.report.rules,graph:result.report.execution_graph}: {official_skills:result.report.official_skills,context:result.context},null,2)+'\n');
    process.exitCode=action==='resolve-official-skills'&&result.report.official_skills.some(s=>s.required&&s.load_status!=='loaded')?2:0;return;
  }
  if(action==='render-report'){safeWrite(flags.output||'report.md',renderReport(json(flags.report)));return;}
  if(action==='attest') {
    if(!flags.review||!flags['private-key']||!flags['key-id']||!flags.origin||!flags['run-id'])throw new Error('attest_requires_review_and_external_signer_identity');
    const root=fs.realpathSync(flags.root||process.cwd()),keyFile=fs.realpathSync(flags['private-key']);
    if(keyFile.startsWith(root+path.sep))throw new Error('signing_key_must_be_outside_candidate_checkout');
    const result=preflight({...options(),localTests:true});outputReport(result);
    if(result.report.overall_status==='INCOMPLETE'||result.report.tool_errors.length) {process.exitCode=2;return;}
    const envelope=signEnvelope(result.report,{privateKey:fs.readFileSync(keyFile),keyId:flags['key-id'],origin:flags.origin,runId:flags['run-id']});
    writeJSON(path.join(options().output,'attestation.json'),envelope);process.exitCode=exitCode(result.report);return;
  }
  if(action==='gate') {
    if(!flags.trust||!flags.attestation)throw new Error('external_trust_and_attestation_required');
    const root=fs.realpathSync(flags.root||process.cwd()),trustPath=fs.realpathSync(flags.trust);
    if(trustPath.startsWith(root+path.sep))throw new Error('trust_must_be_outside_candidate_checkout');
    const result=gate({envelope:json(flags.attestation),trust:json(trustPath),approvals:flags.approvals?json(flags.approvals):[],options:options()});
    if(flags.output)writeJSON(path.join(flags.output,'gate.json'),result);
    process.stdout.write(`${result.status}: ${result.reason}\n`);process.exitCode=result.exit_code;return;
  }
  if(action==='intent') {process.stdout.write(JSON.stringify(classifyIntent({request:flags.request||'',command:flags.command||'',explicit:!!flags.explicit,context:flags.context}),null,2)+'\n');return;}
  if(action==='fingerprint') {process.stdout.write(toolDigest()+'\n');return;}
  if(action==='validate') {validate(flags.schema,json(flags.file));process.stdout.write('valid\n');return;}
  process.stdout.write('cf-cost-safety: preflight | inventory | collect-candidates | resolve-official-skills | render-report | attest | gate | intent | fingerprint | validate | version\nUse --version for the package version. Use --root, --config, --env, --artifact, --builder, --account; see SKILL.md and references/predeploy-gate.md for signed reviews and external trust.\n');
}
try {parseFlags();await main();}catch(e){process.stderr.write(`cost-safety tool error: ${redact(e.message)}\n`);process.exitCode=3;}
