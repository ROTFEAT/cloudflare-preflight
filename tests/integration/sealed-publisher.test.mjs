import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {writeJSON,sha256} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {temp,reviewed} from '../helpers.mjs';
import {controlledRelease} from '../../scripts/release.mjs';

test('PUBLISHER sealed file survives host staging changes and denies writes in namespace',()=>{
  const root=temp(),file=path.join(root,'main.js');fs.writeFileSync(file,'reviewed bytes');
  const handoff=path.join(temp(),'handoff.json');writeJSON(handoff,{stage:root,files:[{path:'main.js',sha256:sha256('reviewed bytes')}]});
  const code=`import importlib.util,json,pathlib,sys
spec=importlib.util.spec_from_file_location('publisher',sys.argv[1]);p=importlib.util.module_from_spec(spec);spec.loader.exec_module(p)
h=json.loads(pathlib.Path(sys.argv[2]).read_text());fds=p.sealed_snapshot(h);pathlib.Path(h['stage'],'main.js').write_text('host changed bytes')
cmd=['/usr/bin/python3','-c',"from pathlib import Path; assert Path('/candidate/main.js').read_text()=='reviewed bytes'; result=False;\\ntry: Path('/candidate/main.js').write_text('bad')\\nexcept OSError: result=True\\nassert result; print('sealed readonly bytes verified')"]
sys.exit(p.run_snapshot(fds,sys.argv[3],cmd,offline=True))`;
  const r=spawnSync('python3',['-c',code,path.resolve('scripts/publish-snapshot.py'),handoff,process.cwd()],{encoding:'utf8',timeout:15000,env:{PATH:process.env.PATH}});
  assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/sealed readonly bytes verified/);
});
test('PUBLISHER real Wrangler consumes sealed prebuilt bytes in offline dry-run only',async()=>{
  const r=reviewed(),external=temp();writeJSON(path.join(external,'trust.json'),r.trust);writeJSON(path.join(external,'attestation.json'),r.envelope);
  const handoff=await controlledRelease({...r.options,trust:path.join(external,'trust.json'),attestation:path.join(external,'attestation.json')});assert.equal(handoff.allowed,true);
  const run=spawnSync(process.execPath,[path.resolve('examples/publisher-wrangler.mjs'),'--handoff',handoff.handoff,'--dry-run'],{encoding:'utf8',timeout:25000,maxBuffer:100000,env:{PATH:process.env.PATH}});
  assert.equal(run.status,0,run.stdout+run.stderr);assert.match(run.stdout,/dry.run|--dry-run|exiting now/i);
});
