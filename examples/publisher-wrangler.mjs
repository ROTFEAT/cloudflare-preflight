#!/usr/bin/env node
// Remote effects live here, outside the skill/analyzer. This example supports
// prebuilt JavaScript Wrangler deploy only. It is never run by engineering tests.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {json,readSafe,sha256,snapshot} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {loadConfig} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/config.mjs';

try {
  if(process.argv[2]!=='--handoff'||!process.argv[3])throw new Error('external_handoff_required');
  const handoff=json(process.argv[3]);
  if(!['ALLOW','ALLOW_WITH_APPROVAL'].includes(handoff.gate_status)||handoff.rebuilt!==false)throw new Error('gate_did_not_allow_handoff');
  if(handoff.identity.target.action!=='deploy')throw new Error('example_publisher_supports_deploy_only');
  if(snapshot(handoff.stage).digest!==handoff.identity.source_snapshot_digest)throw new Error('staged_files_changed');
  for(const file of handoff.files)if(sha256(readSafe(handoff.stage,file.path))!==file.sha256)throw new Error('handoff_bytes_changed');
  const config=loadConfig(handoff.stage,handoff.config_path,handoff.identity.target.environment);
  if(config.gaps.length||config.digest!==handoff.identity.effective_config_digest||config.effective.build?.command)throw new Error('final_config_changed_or_contains_a_build_command');
  if((config.named_environment?handoff.identity.target.environment:null)!==handoff.wrangler_environment)throw new Error('publisher_environment_dispatch_changed');
  if(!/\.[cm]?js$/.test(config.effective.main||''))throw new Error('example_requires_prebuilt_JavaScript_main');
  const require=createRequire(import.meta.url),wranglerPackage=require.resolve('wrangler/package.json');
  const version=json(wranglerPackage).version;
  if(version!=='4.148.0'||handoff.identity.toolchain.wrangler!==version||sha256(fs.readFileSync(wranglerPackage))!==handoff.identity.toolchain.wrangler_package_digest)throw new Error('trusted_publisher_Wrangler_version_or_metadata_mismatch');
  const dryRun=process.argv.includes('--dry-run');
  let token=process.env.CLOUDFLARE_API_TOKEN;
  if(!token&&process.env.COST_SAFETY_DEPLOY_TOKEN_FILE) {
    const tokenFile=fs.realpathSync(process.env.COST_SAFETY_DEPLOY_TOKEN_FILE);
    if(tokenFile.startsWith(handoff.stage+path.sep))throw new Error('publisher_credential_file_must_be_external');
    token=fs.readFileSync(tokenFile,'utf8').trim();
  }
  if(!dryRun&&!token)throw new Error('authorized_publisher_credentials_missing');
  const tools=fileURLToPath(new URL('../',import.meta.url));
  const args=[path.join(tools,'scripts/publish-snapshot.py'),'--handoff',process.argv[3],'--tools-root',tools,...(dryRun?['--dry-run']:[])];
  const result=spawnSync('python3',args,{stdio:'inherit',timeout:120000,env:{PATH:'/usr/bin:/bin',CLOUDFLARE_API_TOKEN:token||'',CLOUDFLARE_ACCOUNT_ID:handoff.identity.target.account_id}});
  if(result.error||result.status!==0)throw new Error('publisher_failed; inspect remote state before retrying');
} catch(error){console.error(`publisher error: ${error.message}`);process.exitCode=3;}
