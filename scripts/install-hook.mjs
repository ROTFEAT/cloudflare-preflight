#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {repository} from './package-lib.mjs';
import {shellQuote} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/intent.mjs';
import {sha256} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';

export function installHook({project,skill,node=process.execPath,releaseEntry,replace=false}) {
  const root=fs.realpathSync(project),installed=fs.realpathSync(skill||path.join(root,'.agents/skills/cloudflare-cost-safety'));
  const launcher=path.join(installed,'hooks/pre-tool-use.py');
  if(!fs.statSync(launcher).isFile()||!path.isAbsolute(node)||!fs.statSync(node).isFile())throw new Error('prepared_hook_and_absolute_node_required');
  const args=['/usr/bin/python3','-I',launcher,'--node',node];
  if(releaseEntry) {
    const entry=fs.realpathSync(releaseEntry);
    if(entry===root||entry.startsWith(root+path.sep))throw new Error('release_entry_must_be_outside_candidate');
    const bytes=fs.readFileSync(entry),expected=fs.readFileSync(path.join(repository,'scripts/release.mjs'));
    if(!bytes.equals(expected))throw new Error('release_entry_must_match_this_versions_controlled_release');
    args.push('--release-entry',entry,'--release-sha256',sha256(bytes));
  }
  const command=args.map(shellQuote).join(' '),directory=path.join(root,'.codex'),file=path.join(directory,'hooks.json');
  if(fs.existsSync(directory)&&fs.realpathSync(directory)!==directory)throw new Error('symlink_hook_directory_rejected');
  let config={};
  if(fs.existsSync(file)) {
    const stat=fs.lstatSync(file);if(!stat.isFile()||stat.size>262144)throw new Error('invalid_existing_hooks');
    config=JSON.parse(fs.readFileSync(file,'utf8'));
  }
  if(!config||typeof config!=='object'||Array.isArray(config)||config.hooks&&typeof config.hooks!=='object')throw new Error('invalid_existing_hooks');
  const groups=config.hooks?.PreToolUse||[];
  if(!Array.isArray(groups))throw new Error('invalid_existing_pre_tool_use');
  const ours=handler=>handler.statusMessage==='Checking Cloudflare release intent'&&handler.command?.includes('/hooks/pre-tool-use.py');
  const existing=groups.flatMap(group=>group.hooks||[]).filter(ours);
  if(existing.length) {
    if(existing.length===1&&existing[0].command===command)return {file,status:'already_configured',trust:'review the current definition with /hooks'};
    if(!replace)throw new Error('cost_safety_hook_already_exists: use --replace to update only this handler; other hooks are preserved');
  }
  const retained=groups.map(group=>({...group,hooks:(group.hooks||[]).filter(handler=>!ours(handler))})).filter(group=>group.hooks.length);
  config.hooks={...config.hooks,PreToolUse:[...retained,{matcher:'^(Bash|mcp__.*)$',hooks:[{type:'command',command,timeout:15,statusMessage:'Checking Cloudflare release intent'}]}]};
  fs.mkdirSync(directory,{recursive:true});
  // Refuse a last-component symlink even if it appeared after the checks.
  const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_NOFOLLOW,0o644);
  try {fs.writeFileSync(fd,JSON.stringify(config,null,2)+'\n');}finally {fs.closeSync(fd);}
  return {file,status:existing.length?'updated':'installed',release_entry:releaseEntry||null,trust:'Open /hooks in Codex, review and trust this definition; installing does not trust or activate it automatically.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),flags={};
    for(let i=0;i<args.length;i++) {if(args[i]==='--replace'){flags.replace=true;continue;}if(!['--project','--skill','--release-entry'].includes(args[i])||!args[i+1])throw new Error('usage: install-hook.mjs --project /APPLICATION [--skill /TRUSTED/skill] [--release-entry /TRUSTED/scripts/release.mjs] [--replace]');flags[args[i].slice(2)]=args[++i];}
    if(!flags.project)throw new Error('project_required');
    console.log(JSON.stringify(installHook({project:flags.project,skill:flags.skill,releaseEntry:flags['release-entry'],replace:flags.replace}),null,2));
  } catch(error) {console.error(error.message);process.exitCode=3;}
}
