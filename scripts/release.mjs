#!/usr/bin/env node
// Install this entry and its imports in a protected tools directory. Never use
// a candidate-controlled copy as a security boundary.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {gate} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/gate.mjs';
import {json,readSafe,snapshot,sha256,writeJSON,digest} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {loadConfig} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/config.mjs';

export async function controlledRelease(request,publish) {
  if(['CLOUDFLARE_API_TOKEN','CLOUDFLARE_API_KEY','CLOUDFLARE_EMAIL','CF_API_TOKEN','CF_API_KEY','CF_AUTH_KEY'].some(name=>process.env[name]))throw new Error('analyzer_must_not_inherit_Cloudflare_credentials; the external publisher loads credentials after the gate');
  const root=fs.realpathSync(request.root);
  const trustPath=fs.realpathSync(request.trust);
  if(trustPath===root||trustPath.startsWith(root+path.sep))throw new Error('release_trust_must_be_external');
  const options={root,config:request.config,environment:request.environment||'production',artifact:request.artifact,builder:request.builder,account:request.account,action:request.action||'deploy',candidateVersion:request.candidateVersion,wranglerPackage:request.wranglerPackage,policy:request.policy?json(request.policy):undefined};
  const result=gate({envelope:json(request.attestation),trust:json(trustPath),approvals:request.approvals?json(request.approvals):[],options});
  if(!result.allowed)return {...result,publisher_calls:0};
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cf-cost-release-'));
  const stage=path.join(directory,'candidate');fs.mkdirSync(stage,{mode:0o700});
  try {
    // Hash every copied file against the signed snapshot. A concurrent source
    // change cannot silently replace the bytes consumed by the publisher.
    for(const file of result.report.scope.files) {
      const bytes=readSafe(root,file.path);
      if(sha256(bytes)!==file.sha256)throw new Error('source_changed_during_staging');
      const target=path.join(stage,file.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{mode:0o400});
    }
    if(snapshot(stage).digest!==result.identity.source_snapshot_digest)throw new Error('staged_snapshot_mismatch');
    function protect(dir) {
      for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
        const file=path.join(dir,entry.name);if(entry.isDirectory())protect(file);else fs.chmodSync(file,0o444);
      }
      fs.chmodSync(dir,0o555);
    }
    protect(stage);
    const config=loadConfig(stage,result.identity.config_path,result.identity.target.environment);
    const handoff={schema_version:'1.0',stage,identity:result.identity,config_path:result.identity.config_path,wrangler_environment:config.named_environment?result.identity.target.environment:null,artifact_path:result.identity.artifact_path,files:result.report.scope.files,gate_status:result.status,rebuilt:false};
    const handoffPath=path.join(directory,'handoff.json');writeJSON(handoffPath,handoff);fs.chmodSync(handoffPath,0o444);
    if(publish)await publish(handoff,handoffPath);
    if(snapshot(stage).digest!==result.identity.source_snapshot_digest)throw new Error('publisher_modified_staged_bytes; inspect remote state before retrying');
    return {allowed:true,exit_code:0,status:result.status,publisher_calls:publish?1:0,handoff:handoffPath,identity_digest:result.identity.digest,staged_files_digest:digest(handoff.files)};
  } catch(error) {
    // Directories are intentionally read-only; restore only for local cleanup.
    function writable(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isDirectory())writable(path.join(dir,e.name));fs.chmodSync(dir,0o700);}
    writable(directory);fs.rmSync(directory,{recursive:true,force:true});throw error;
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),flags={};
    for(let i=0;i<args.length;i++){if(!args[i].startsWith('--'))throw new Error('named_arguments_required');flags[args[i].slice(2)]=args[i+1]&&!args[i+1].startsWith('--')?args[++i]:true;}
    if(!flags.request)throw new Error('usage: release.mjs --request /EXTERNAL/release.json [--execute --publisher /TRUSTED/publisher.mjs]');
    if(!!flags.execute!==!!flags.publisher)throw new Error('execute_requires_an_explicit_trusted_publisher');
    const request=json(flags.request);
    let publish;
    if(flags.execute) {
      const publisher=fs.realpathSync(flags.publisher),root=fs.realpathSync(request.root);
      if(publisher.startsWith(root+path.sep))throw new Error('publisher_must_be_external');
      publish=(_,handoff)=>{
        const executed=spawnSync(process.execPath,[publisher,'--handoff',handoff],{stdio:'inherit',timeout:120000,env:process.env});
        if(executed.error||executed.status!==0)throw new Error('trusted_publisher_failed_or_timed_out');
      };
    }
    const result=await controlledRelease(request,publish);console.log(JSON.stringify(result,null,2));process.exitCode=result.exit_code;
  } catch(error) {console.error(`release tool error: ${error.message}`);process.exitCode=3;}
}
