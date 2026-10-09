import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {decideHook} from '../../.agents/skills/cloudflare-cost-safety/hooks/pre-tool-use.mjs';
import {parseShell,shellQuote} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/intent.mjs';
import {SKILL_ROOT,writeJSON,sha256,json} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {installHook} from '../../scripts/install-hook.mjs';
import {application,temp,reviewed} from '../helpers.mjs';

const event=(root,command)=>({hook_event_name:'PreToolUse',cwd:root,tool_name:'Bash',tool_input:{command}});
const denied=result=>result.hookSpecificOutput?.permissionDecision==='deny';
function launch(input,args=[]) {
  const run=spawnSync('/usr/bin/python3',['-I',path.join(SKILL_ROOT,'hooks/pre-tool-use.py'),'--node',process.execPath,...args],{input:typeof input==='string'?input:JSON.stringify(input),encoding:'utf8',timeout:12000,env:{PATH:'/usr/bin:/bin',NODE_OPTIONS:'--require /NONEXISTENT/CANARY.cjs'}});
  assert.equal(run.status,0,run.stderr);return JSON.parse(run.stdout);
}
test('HOOK literal shell parsing keeps examples inert and identifies real chained commands',()=>{
  const root=application();
  for(const command of ['echo "wrangler deploy"',"rg 'wrangler deploy' README.md",'git status --short','# wrangler deploy\npwd'])assert.deepEqual(decideHook(event(root,command)),{},command);
  for(const command of ['echo ready && wrangler deploy','printf ready; npx wrangler deploy','echo "$(wrangler deploy)"'])assert.ok(denied(decideHook(event(root,command))),command);
  assert.deepEqual(parseShell("printf '%s' 'a; b'"),{segments:[['printf','%s','a; b']],unknown:false,compound:false});
  fs.writeFileSync(path.join(root,'package.json'),'{invalid');assert.deepEqual(decideHook(event(root,'cat package.json')),{});
});
test('HOOK recognizes Worker Pages version preview rollback and secret release operations',()=>{
  const root=application();
  for(const command of ['wrangler deploy','npx -y wrangler@4.148.0 deploy --env staging','npm exec -- wrangler pages deploy dist','pnpm exec wrangler versions upload','yarn dlx wrangler versions deploy','bunx wrangler rollback','wrangler preview','wrangler preview secret put KEY','wrangler secret bulk vars.json','wrangler versions secret delete KEY','wrangler triggers deploy','cf deploy','cf previews deploy branch','cf workers versions create','node node_modules/wrangler/bin/wrangler.js deploy']) {
    const result=decideHook(event(root,command));assert.ok(denied(result),command);assert.match(result.hookSpecificOutput.permissionDecisionReason,/\$cloudflare-cost-safety/);
  }
});
test('HOOK distinguishes local commands help dry runs and false boolean flags',()=>{
  const root=application();writeJSON(path.join(root,'package.json'),{scripts:{build:'vite build',test:'vitest run'}});
  for(const command of ['npm run build','pnpm test','wrangler types','pnpm wrangler types','yarn wrangler versions list','node --version','wrangler dev','wrangler pages dev dist','wrangler deploy --help','wrangler versions list','wrangler deploy --dry-run','wrangler versions upload --dry-run=true','vercel deploy'])assert.deepEqual(decideHook(event(root,command)),{},command);
  for(const command of ['wrangler dev --remote','wrangler deploy --dry-run=false','wrangler deploy --dry-run false','wrangler deploy --dry-run --no-dry-run','wrangler preview --dry-run'])assert.ok(denied(decideHook(event(root,command))),command);
});
test('HOOK expands arbitrary package script names and before/after lifecycle scripts',()=>{
  const root=application();writeJSON(path.join(root,'package.json'),{scripts:{ship:'wrangler deploy',build:'vite build',postbuild:'npm run ship',test:'vitest run',pretest:'wrangler versions upload'}});
  for(const command of ['npm run ship','pnpm ship','yarn ship','bun run ship','npm run build','yarn test'])assert.ok(denied(decideHook(event(root,command))),command);
});
test('HOOK respects cd package prefixes and a nested working directory',()=>{
  const root=temp(),app=path.join(root,'apps/site');fs.mkdirSync(path.join(app,'src'),{recursive:true});
  writeJSON(path.join(root,'package.json'),{scripts:{ship:'echo local'}});writeJSON(path.join(app,'package.json'),{scripts:{ship:'wrangler deploy'}});
  for(const command of ['cd apps/site && npm run ship','npm --prefix apps/site run ship','pnpm --dir apps/site ship'])assert.ok(denied(decideHook(event(root,command))),command);
  assert.ok(denied(decideHook(event(path.join(app,'src'),'npm run ship'))));
  fs.writeFileSync(path.join(app,'src/release.mjs'),'import {spawnSync} from "node:child_process"; spawnSync("wrangler",["deploy"]);');
  assert.ok(denied(decideHook(event(path.join(app,'src'),'node release.mjs'))));
});
test('HOOK statically reads literal Node and shell wrappers without executing candidate code',()=>{
  const root=application(),marker=path.join(root,'MUST_NOT_EXIST');
  fs.writeFileSync(path.join(root,'release.mjs'),`import fs from 'node:fs';import {spawnSync} from 'node:child_process';fs.writeFileSync(${JSON.stringify(marker)},'executed');spawnSync('wrangler',['deploy']);`);
  fs.writeFileSync(path.join(root,'release.sh'),`touch ${shellQuote(marker)}\nwrangler deploy\n`);
  for(const command of ['node release.mjs','sh release.sh',"bash -lc 'wrangler deploy'"])assert.ok(denied(decideHook(event(root,command))),command);
  assert.equal(fs.existsSync(marker),false);
});
test('HOOK leaves dynamic and recursive Cloudflare wrappers incomplete',()=>{
  const root=application();writeJSON(path.join(root,'package.json'),{scripts:{ship:'npm run ship'}});
  fs.writeFileSync(path.join(root,'dynamic.mjs'),'import {spawnSync} from "node:child_process";spawnSync("wrangler",[process.env.ACTION]);');
  for(const command of ['npm run ship','node dynamic.mjs','eval "$DEPLOY_COMMAND"','python3 -c "deploy_with_sdk()"','cf workers scripts update','npm --workspace app run ship'])assert.match(decideHook(event(root,command)).hookSpecificOutput.permissionDecisionReason,/INCOMPLETE/);
});
test('HOOK dry runs inspect custom build commands and local dev checks remote bindings',()=>{
  const root=application({build:{command:'wrangler deploy'}});
  assert.ok(denied(decideHook(event(root,'wrangler deploy --dry-run'))));
  writeJSON(path.join(root,'wrangler.jsonc'),{name:'local',main:'main.js',kv_namespaces:[{binding:'KV',id:'synthetic',remote:true}]});
  assert.ok(denied(decideHook(event(root,'wrangler dev'))));
  fs.writeFileSync(path.join(root,'cloudflare.config.ts'),'throw new Error("DO_NOT_EXECUTE")');
  assert.ok(denied(decideHook(event(root,'cf previews deploy'))));
});
test('HOOK detects Cloudflare frameworks and release HTTP calls without blocking API reads',()=>{
  const root=application();
  for(const command of ['npx opennextjs-cloudflare deploy','npx nuxthub deploy','terraform apply','pulumi up','curl -X PUT https://api.cloudflare.com/client/v4/accounts/A/workers/scripts/app','curl -d@payload https://api.cloudflare.com/client/v4/accounts/A/workers/scripts/app'])assert.ok(denied(decideHook(event(root,command))),command);
  assert.deepEqual(decideHook(event(root,'curl -X GET https://api.cloudflare.com/client/v4/accounts/A/workers/scripts')),{});
});
test('HOOK covers publishing MCP tools and permits metadata reads and ordinary edits',()=>{
  const root=application();
  for(const [name,input] of [['mcp__cloudflare__workers_deploy',{}],['mcp__codex_apps__cloudflare_create_worker',{}],['mcp__platform__release',{provider:'cloudflare',action:'deploy'}],['mcp__cloudflare__api',{method:'PUT',url:'https://api.cloudflare.com/client/v4/accounts/A/workers/scripts/app'}]])assert.ok(denied(decideHook({...event(root,''),tool_name:name,tool_input:input})),name);
  for(const name of ['mcp__cloudflare__list_deployments','mcp__cloudflare__get_worker','mcp__vercel__deploy','apply_patch'])assert.deepEqual(decideHook({...event(root,''),tool_name:name,tool_input:{}}),{},name);
});
test('HOOK missing runtime malformed events and excessive input produce explicit denial without leaking secrets',()=>{
  const root=application(),canary='SYNTHETIC_SECRET_MUST_NOT_BE_PRINTED';
  for(const input of ['{bad-json',JSON.stringify({value:canary}),' '.repeat(1048577)]) {const result=launch(input);assert.ok(denied(result));assert.equal(JSON.stringify(result).includes(canary),false);}
  const run=spawnSync('/usr/bin/python3',['-I',path.join(SKILL_ROOT,'hooks/pre-tool-use.py'),'--node','/MISSING/node'],{input:JSON.stringify(event(root,'wrangler deploy')),encoding:'utf8'});
  assert.equal(run.status,0);assert.ok(denied(JSON.parse(run.stdout)));
  assert.ok(denied(launch(event(root,'wrangler deploy')))); // NODE_OPTIONS above cannot reach the analysis worker.
});
test('HOOK special files symlinks and oversized package metadata are denied',()=>{
  for(const kind of ['symlink','oversize','fifo']) {
    const root=application(),file=path.join(root,'package.json');
    if(kind==='symlink'){const external=path.join(temp(),'package.json');writeJSON(external,{scripts:{ship:'wrangler deploy'}});fs.symlinkSync(external,file);}
    else if(kind==='oversize')fs.writeFileSync(file,' '.repeat(262145));
    else assert.equal(spawnSync('mkfifo',[file]).status,0);
    assert.ok(denied(launch(event(root,'npm run ship'))),kind);
  }
});
test('HOOK installer preserves other hooks is idempotent and requires host trust',()=>{
  const root=application();fs.mkdirSync(path.join(root,'.codex'));const original={description:'existing',hooks:{Stop:[{hooks:[{type:'command',command:'true'}]}],PreToolUse:[{matcher:'Edit',hooks:[{type:'command',command:'true'}]}]}};writeJSON(path.join(root,'.codex/hooks.json'),original);
  const installed=installHook({project:root,skill:SKILL_ROOT});const config=json(installed.file);
  assert.deepEqual(config.hooks.Stop,original.hooks.Stop);assert.deepEqual(config.hooks.PreToolUse[0],original.hooks.PreToolUse[0]);assert.equal(config.hooks.PreToolUse.length,2);assert.match(installed.trust,/\/hooks/);assert.equal(installHook({project:root,skill:SKILL_ROOT}).status,'already_configured');
  assert.match(config.hooks.PreToolUse[1].hooks[0].command,/python3.*-I/);assert.equal(config.hooks.PreToolUse[1].hooks[0].async,undefined);
  assert.throws(()=>installHook({project:root,skill:SKILL_ROOT,node:'/bin/node'}),/already_exists/);
  const updated=installHook({project:root,skill:SKILL_ROOT,node:'/bin/node',replace:true});assert.equal(updated.status,'updated');
  assert.deepEqual(json(updated.file).hooks.Stop,original.hooks.Stop);assert.equal(json(updated.file).hooks.PreToolUse.length,2);
});
test('HOOK installer rejects candidate release entries and unrelated programs',()=>{
  const root=application(),entry=path.join(root,'release.mjs');fs.copyFileSync('scripts/release.mjs',entry);
  assert.throws(()=>installHook({project:root,skill:SKILL_ROOT,releaseEntry:entry}),/outside_candidate/);
  const external=path.join(temp(),'release.mjs');fs.writeFileSync(external,'console.log("not a gate")');assert.throws(()=>installHook({project:root,skill:SKILL_ROOT,releaseEntry:external}),/must_match/);
});
test('HOOK project Skill installer also registers the Hook without running application scripts',()=>{
  const root=application(),marker=path.join(root,'MUST_NOT_EXECUTE');writeJSON(path.join(root,'package.json'),{scripts:{postinstall:`touch ${marker}`}});
  const result=spawnSync(process.execPath,['scripts/install.mjs','--project',root],{encoding:'utf8',timeout:15000,env:{PATH:'/usr/bin:/bin'}});
  assert.equal(result.status,0,result.stderr);const installed=JSON.parse(result.stdout);assert.equal(installed.hook.status,'installed');
  assert.equal(json(path.join(root,'.codex/hooks.json')).hooks.PreToolUse.length,1);assert.equal(fs.existsSync(marker),false);
  assert.ok(fs.existsSync(path.join(installed.destination,'hooks/pre-tool-use.py')));
});
function registered(root) {
  const tools=temp();fs.mkdirSync(path.join(tools,'scripts'));fs.mkdirSync(path.join(tools,'.agents/skills'),{recursive:true});
  fs.copyFileSync('scripts/release.mjs',path.join(tools,'scripts/release.mjs'));fs.symlinkSync(SKILL_ROOT,path.join(tools,'.agents/skills/cloudflare-cost-safety'));
  const entry=path.join(tools,'scripts/release.mjs'),request=path.join(tools,'request.json'),publisher=path.join(tools,'mock-publisher.mjs'),marker=path.join(tools,'published');
  fs.writeFileSync(publisher,`import fs from 'node:fs';fs.writeFileSync(${JSON.stringify(marker)},'MOCK_NO_CLOUDFLARE_CALL');`);
  const registration={entry,sha256:sha256(fs.readFileSync(entry)),node:process.execPath};
  const tokens=[process.execPath,entry,'--request',request,'--execute','--publisher',publisher];
  return {tools,entry,request,publisher,marker,registration,tokens,command:tokens.map(shellQuote).join(' ')};
}
test('HOOK exact registered entry is handed to the independent gate; fake PASS never publishes',()=>{
  const root=application(),r=registered(root);writeJSON(path.join(r.tools,'fake.json'),{payload:{overall_status:'PASS'}});writeJSON(path.join(r.tools,'trust.json'),{});
  writeJSON(r.request,{root,artifact:'main.js',builder:'synthetic',trust:path.join(r.tools,'trust.json'),attestation:path.join(r.tools,'fake.json')});
  assert.deepEqual(decideHook(event(root,r.command),r.registration),{});
  const result=spawnSync(r.tokens[0],r.tokens.slice(1),{encoding:'utf8',env:{PATH:'/usr/bin:/bin'},timeout:15000});
  assert.notEqual(result.status,0);assert.equal(fs.existsSync(r.marker),false);
  assert.ok(denied(launch(event(root,r.command+' && wrangler deploy'),['--release-entry',r.entry,'--release-sha256',r.registration.sha256])));
  assert.ok(denied(launch(event(root,r.command+' &'),['--release-entry',r.entry,'--release-sha256',r.registration.sha256])));
  fs.appendFileSync(r.entry,'\n// changed');assert.ok(denied(launch(event(root,r.command),['--release-entry',r.entry,'--release-sha256',r.registration.sha256])));
});
test('HOOK registered entry publishes only current synthetic signed evidence and rejects source drift',()=>{
  const reviewedApp=reviewed(),r=registered(reviewedApp.root);
  writeJSON(path.join(r.tools,'trust.json'),reviewedApp.trust);writeJSON(path.join(r.tools,'attestation.json'),reviewedApp.envelope);
  writeJSON(r.request,{...reviewedApp.options,trust:path.join(r.tools,'trust.json'),attestation:path.join(r.tools,'attestation.json')});
  assert.deepEqual(decideHook(event(reviewedApp.root,r.command),r.registration),{});
  const run=()=>spawnSync(r.tokens[0],r.tokens.slice(1),{encoding:'utf8',env:{PATH:'/usr/bin:/bin'},timeout:15000});
  let result=run();assert.equal(result.status,0,result.stderr+result.stdout);assert.equal(fs.readFileSync(r.marker,'utf8'),'MOCK_NO_CLOUDFLARE_CALL');
  fs.rmSync(r.marker);fs.appendFileSync(path.join(reviewedApp.root,'main.js'),'\n// unreviewed change');result=run();assert.notEqual(result.status,0);assert.equal(fs.existsSync(r.marker),false);
  assert.ok(denied(decideHook(event(reviewedApp.root,'wrangler deploy'))));
});
