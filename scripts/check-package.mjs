#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {installSkill,repository} from './package-lib.mjs';
import {sha256,writeJSON,json,VERSION,DISPLAY_VERSION,SKILL_ROOT} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';

const directory=fs.mkdtempSync(path.join(os.tmpdir(),'cf-cost-package-'));
try {
  const pkg=json(path.join(repository,'package.json')),lock=json(path.join(repository,'package-lock.json'));
  const versions=[pkg.version,lock.version,lock.packages[''].version,json(path.join(SKILL_ROOT,'assets/rules/catalog.json')).version,json(path.join(repository,'rules/catalog.json')).version];
  if(versions.some(version=>version!==VERSION))throw new Error('release_version_mismatch');
  const distribution=path.join(directory,'distribution/cloudflare-cost-safety');
  const installed=installSkill(distribution);
  const archive=path.join(repository,'.cost-safety',`cloudflare-cost-safety-${VERSION}.tar.gz`);
  fs.mkdirSync(path.dirname(archive),{recursive:true});
  const packed=spawnSync('tar',['-czf',archive,'-C',path.dirname(distribution),'cloudflare-cost-safety'],{encoding:'utf8',timeout:30000});
  if(packed.status!==0)throw new Error(`tar_failed:${packed.stderr}`);
  const candidate=path.join(directory,'clean-application');fs.mkdirSync(path.join(candidate,'.agents/skills'),{recursive:true});
  const unpacked=spawnSync('tar',['-xzf',archive,'-C',path.join(candidate,'.agents/skills')],{encoding:'utf8',timeout:30000});
  if(unpacked.status!==0)throw new Error('unpack_failed');
  fs.writeFileSync(path.join(candidate,'main.js'),'export default {fetch(){return new Response("offline package test")}};');
  writeJSON(path.join(candidate,'wrangler.jsonc'),{name:'package-test',account_id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',main:'main.js',compatibility_date:'2026-10-08'});
  writeJSON(path.join(candidate,'package-lock.json'),{lockfileVersion:3,packages:{'node_modules/wrangler':{version:'4.148.0'}}});
  const skill=path.join(candidate,'.agents/skills/cloudflare-cost-safety');
  const installedRelease=json(path.join(skill,'version.json'));
  if(installedRelease.version!==VERSION||installedRelease.display_version!==DISPLAY_VERSION)throw new Error('installed_release_version_mismatch');
  const inventory=JSON.parse(fs.readFileSync(path.join(skill,'runtime-dependencies.json')));
  for(const pkg of inventory.packages)for(const [file,expected] of Object.entries(pkg.files))if(sha256(fs.readFileSync(path.join(skill,pkg.path,file)))!==expected)throw new Error('dependency_bytes_changed');
  // The namespace can see only this clean app and OS files; it cannot fall
  // back to this repository's node_modules or access the network/home.
  const executed=spawnSync('python3',[path.join(repository,'scripts/sandbox.py'),'--cwd',candidate,'--timeout','20','--','node','.agents/skills/cloudflare-cost-safety/scripts/cli.mjs','preflight','--root','/workspace','--artifact','main.js','--builder','package-check-direct-js@1','--local-tests','--output','/tmp/package-report'],{encoding:'utf8',timeout:30000,maxBuffer:100000,env:{PATH:process.env.PATH}});
  if(!/INCOMPLETE: \/tmp\/package-report\/report.md/.test(executed.stdout)||!/"exit_code": 2/.test(executed.stdout))throw new Error(`isolated_package_preflight_failed:${executed.stdout}${executed.stderr}`);
  const versionCheck=spawnSync('python3',[path.join(repository,'scripts/sandbox.py'),'--cwd',candidate,'--timeout','10','--','node','.agents/skills/cloudflare-cost-safety/scripts/cli.mjs','--version'],{encoding:'utf8',timeout:15000,maxBuffer:100000,env:{PATH:process.env.PATH}});
  if(versionCheck.status!==0||!versionCheck.stdout.split('\n').includes(VERSION))throw new Error('isolated_package_version_check_failed');
  // Missing semantic review must deny the gate even in a clean installation.
  if(!fs.existsSync(path.join(skill,'scripts/sandbox.py')))throw new Error('bundled_sandbox_missing');
  let refused=false;try{installSkill(distribution);}catch{refused=true;}if(!refused)throw new Error('installer_overwrote_existing_skill');
  const record={status:'passed',version:VERSION,display_version:DISPLAY_VERSION,tag:`v${DISPLAY_VERSION}`,archive,sha256:sha256(fs.readFileSync(archive)),bytes:fs.statSync(archive).size,prepared_dependencies:installed.dependencies,official_revision:installed.official_revision,clean_install:'actual tar extraction and offline isolated CLI',version_check:versionCheck.stdout,semantic_review:'not executed; expected exit 2',runtime_network:'denied',stdout:executed.stdout};
  writeJSON(path.join(repository,'.cost-safety/package-check.json'),record);
  console.log(JSON.stringify(record,null,2));
} finally {fs.rmSync(directory,{recursive:true,force:true});}
