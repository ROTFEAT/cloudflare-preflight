import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseShell,resolveCommand} from '../scripts/lib/intent.mjs';
import {loadConfig} from '../scripts/lib/config.mjs';

const skillRoot=fileURLToPath(new URL('../',import.meta.url));
const inside=(root,file)=>file===root||file.startsWith(root+path.sep);
const deny=reason=>({hookSpecificOutput:{hookEventName:'PreToolUse',permissionDecision:'deny',permissionDecisionReason:reason}});
const guidance='Use $cloudflare-cost-safety now. Review the pinned official guidance, current source, final artifact, effective config and target; run the required application checks. Then use a registered protected release entry, which independently verifies signed evidence before publishing. A report.json, gate.json or an earlier PASS does not unlock direct deployment.';

// No candidate code is executed. Refuse symlinks, special files, oversized
// files and reads outside the selected package; cap the total metadata reads.
function reader() {
  let remaining=64;
  return (root,name)=> {
    if(--remaining<0)throw new Error('read_budget');
    const file=path.resolve(root,name);
    if(!inside(root,file))throw new Error('outside_package');
    let fd;
    try {
      if(!inside(root,fs.realpathSync(path.dirname(file))))throw new Error('outside_package');
      fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
      const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.size>262144)throw new Error('metadata_limit');
      const bytes=Buffer.alloc(262145),size=fs.readSync(fd,bytes,0,bytes.length,0);
      if(size>262144)throw new Error('metadata_limit');
      return bytes.subarray(0,size).toString();
    } catch(error) {if(error.code==='ENOENT')return null;throw error;}
    finally {if(fd!==undefined)fs.closeSync(fd);}
  };
}
function contextLoader(read,onCloudflare) {
  const cache=new Map();
  return directory=> {
    const executionCwd=fs.realpathSync(directory);if(cache.has(executionCwd))return cache.get(executionCwd);
    let cwd=executionCwd,pkg=null;
    for(let depth=0;depth<20;depth++) {
      const text=read(cwd,'package.json');
      if(text!==null){pkg=JSON.parse(text);break;}
      if(fs.existsSync(path.join(cwd,'.git'))||['wrangler.jsonc','wrangler.json','wrangler.toml','cloudflare.config.ts'].some(f=>fs.existsSync(path.join(cwd,f)))||path.dirname(cwd)===cwd)break;
      cwd=path.dirname(cwd);
    }
    const deps={...pkg?.dependencies,...pkg?.devDependencies};
    const cloudflare=['wrangler.jsonc','wrangler.json','wrangler.toml','cloudflare.config.ts'].some(f=>fs.existsSync(path.join(cwd,f)))||Object.keys(deps).some(name=>/^(?:wrangler|@cloudflare\/vite-plugin|@opennextjs\/cloudflare|@astrojs\/cloudflare|@nuxthub\/core)$/.test(name));
    if(cloudflare)onCloudflare();
    const scripts=pkg?.scripts||{};if(typeof scripts!=='object'||Array.isArray(scripts))throw new Error('invalid_scripts');
    const sourceCache=new Map();
    const texts={has(name){return this.get(name)!==undefined;},get(name){if(!sourceCache.has(name)){const text=read(executionCwd,name);sourceCache.set(name,text===null?undefined:text);}return sourceCache.get(name);}};
    const context={cwd:executionCwd,root:cwd,scripts,texts,cloudflare};cache.set(executionCwd,context);return context;
  };
}
function configCheck(args,cwd) {
  let file,environment='default';
  for(let i=0;i<args.length;i++) {
    if(['--config','-c'].includes(args[i]))file=args[++i];
    else if(args[i].startsWith('--config='))file=args[i].slice(9);
    else if(['--env','-e'].includes(args[i]))environment=args[++i];
    else if(args[i].startsWith('--env='))environment=args[i].slice(6);
    else if(args[i]==='--cwd')cwd=fs.realpathSync(path.resolve(cwd,args[++i]));
    else if(args[i].startsWith('--cwd='))cwd=fs.realpathSync(path.resolve(cwd,args[i].slice(6)));
  }
  const config=loadConfig(cwd,file,environment);
  const unknown=config.gaps.some(g=>!['compatibility_date_unknown','remote_binding_forbidden_in_local_tests'].includes(g.reason));
  return {unknown,buildCommand:config.effective.build?.command,remoteBinding:config.bindings.some(b=>b.remote)};
}
function isReviewCli(tokens,cwd) {
  return ['node','node.exe'].includes(path.basename(tokens[0]||''))&&path.resolve(cwd,tokens[1]||'')===path.join(skillRoot,'scripts/cli.mjs')&&['preflight','inventory','collect-candidates','resolve-official-skills','render-report','attest','gate','intent','fingerprint','validate','version','--version'].includes(tokens[2]);
}
function isProtectedEntry(parsed,cwd,registration) {
  if(!registration.entry||!registration.sha256||parsed.unknown||parsed.compound||parsed.segments.length!==1)return false;
  const tokens=parsed.segments[0];
  if(tokens[0]!==registration.node||tokens[1]!==registration.entry)return false;
  const args=tokens.slice(2);
  if(args.length!==2&&args.length!==5||args[0]!=='--request'||!path.isAbsolute(args[1]))return false;
  if(args.length===5&&(args[2]!=='--execute'||args[3]!=='--publisher'||!path.isAbsolute(args[4])))return false;
  for(const file of [registration.entry,args[1],...(args.length===5?[args[4]]:[])])if(inside(cwd,fs.realpathSync(file)))return false;
  const fd=fs.openSync(registration.entry,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
  try {const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.size>262144)return false;return crypto.createHash('sha256').update(fs.readFileSync(fd)).digest('hex')===registration.sha256;}
  finally {fs.closeSync(fd);}
}
export function decideHook(event,registration={}) {
  if(event.hook_event_name!=='PreToolUse'||typeof event.tool_name!=='string'||typeof event.cwd!=='string'||!path.isAbsolute(event.cwd))throw new Error('invalid_hook_event');
  const tool=event.tool_name,input=event.tool_input||{};
  if(/^(?:Bash|exec_command|shell|shell_command)$/.test(tool)) {
    const command=input.command??input.cmd;if(typeof command!=='string')throw new Error('command_required');
    const cwd=fs.realpathSync(path.resolve(event.cwd,input.workdir||input.cwd||'.')),parsed=parseShell(command);
    const readers=new Set(['echo','printf','rg','grep','cat','sed','head','tail','ls','pwd','git','wc','diff']);
    if(!parsed.unknown&&parsed.segments.every(tokens=>readers.has(tokens[0])&&!tokens.some(t=>t==='--pre'||t.startsWith('--pre='))))return {};
    let cloudflare=false;
    const read=reader(),load=contextLoader(read,()=>{cloudflare=true;}),context=load(cwd);
    if(isProtectedEntry(parsed,context.root,registration))return {};
    const result=resolveCommand(command,context.scripts,context.texts,new Set(),{...context,load,configCheck,isReviewCli});
    const effects=result.effects.some(e=>e.type!=='remote_data');
    const relevant=result.expanded.some(text=>/\b(?:wrangler|cloudflare|opennextjs-cloudflare|cf)\b/i.test(text)&&/\b(?:deploy|publish|upload|promote|rollback|preview|secret|release)\b/i.test(text));
    if(effects)return deny('Cloudflare release intercepted before execution. '+guidance);
    const opaqueRelease=result.expanded.some(text=>/\b(?:deploy|publish|promote|rollback|release|ship)\b/i.test(text));
    if(result.unknown&&(cloudflare||result.cloudflare||relevant||opaqueRelease))return deny('Command effects or Cloudflare target are unresolved (INCOMPLETE). Do not execute an opaque release wrapper to discover its effects. '+guidance);
    return {};
  }
  if(/^mcp__/.test(tool)) {
    const serialized=JSON.stringify(input);if(serialized.length>65536)throw new Error('tool_input_limit');
    const name=tool.toLowerCase(),cloudflare=/cloudflare|wrangler/.test(name)||/(?:"(?:provider|platform)"\s*:\s*"cloudflare"|api\.cloudflare\.com)/i.test(serialized);
    const operation=[name,...['action','operation','method','command'].map(k=>typeof input[k]==='string'?input[k].toLowerCase():'')].join(' ');
    const write=/deploy|publish|upload|promot|rollback|release|preview.*creat|creat.*(?:worker|preview)|\b(?:post|put|patch)\b/.test(operation);
    const readOnly=/(?:^|__|_)(?:get|list|read|search|describe|fetch|status)(?:_|\b)/.test(name)&&!['action','operation','method','command'].some(k=>typeof input[k]==='string'&&/deploy|publish|upload|promot|rollback|\b(?:post|put|patch)\b/i.test(input[k]));
    if(cloudflare&&write&&!readOnly)return deny('Cloudflare publishing tool intercepted before execution. '+guidance);
  }
  return {};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),registration={node:process.execPath};
  for(let i=0;i<args.length;i+=2) {if(args[i]==='--release-entry')registration.entry=args[i+1];else if(args[i]==='--release-sha256')registration.sha256=args[i+1];else throw new Error('unknown_hook_option');}
  const event=JSON.parse(fs.readFileSync(0,'utf8'));
  process.stdout.write(JSON.stringify(decideHook(event,registration))+'\n');
}
