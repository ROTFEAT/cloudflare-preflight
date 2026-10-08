import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {temp} from '../helpers.mjs';

const runner=path.resolve('.agents/skills/cloudflare-cost-safety/scripts/sandbox.py');
function run(program,extra=[],env={}) {
  const root=temp();fs.writeFileSync(path.join(root,'.env'),'SYNTHETIC_CANARY=never_visible');
  const result=spawnSync('python3',[runner,'--cwd',root,'--timeout','1',...extra,'--','node','-e',program],{encoding:'utf8',env:{PATH:process.env.PATH,...env},timeout:12000,maxBuffer:100000});
  assert.equal(result.error,undefined);
  const lines=result.stdout.trim().split('\n'),record=JSON.parse(lines.at(-1));
  return {...record,output:lines.slice(0,-1).join('\n'),process_status:result.status,root};
}
test('SANDBOX parent kills synchronous and continuous microtask loops',()=>{
  for(const code of ['while(true){}','const again=()=>queueMicrotask(again);again()']) {
    const result=run(code);assert.equal(result.status,'timeout');assert.equal(result.process_status,1);assert.ok(result.duration_ms<5000);assert.equal(result.process_group_killed,true);
  }
});
test('SANDBOX no host credentials, credential file content, writes or network escape',()=>{
  const result=run(`const fs=require('node:fs');if(process.env.CLOUDFLARE_API_TOKEN)throw Error('inherited');let data='';try{data=fs.readFileSync('.env','utf8')}catch(e){if(e.code!=='EACCES')throw e}if(data)throw Error('credential file');try{fs.writeFileSync('escape','bad');process.exit(4)}catch{};fetch('https://example.com').then(()=>process.exit(5),()=>console.log('isolated'));`,[],{CLOUDFLARE_API_TOKEN:'SYNTHETIC_CANARY_TOKEN_NOT_REAL'});
  assert.equal(result.status,'passed',result.output);assert.match(result.output,/isolated/);assert.doesNotMatch(result.output,/CANARY|never_visible/);assert.equal(fs.existsSync(path.join(result.root,'escape')),false);
});
test('SANDBOX output and actual resident memory budgets abort children',()=>{
  const output=run(`while(true)process.stdout.write('x'.repeat(8192))`);assert.equal(output.status,'output_budget_exceeded');
  const memory=run(`const a=[];setInterval(()=>{for(let i=0;i<10;i++)a.push(Buffer.alloc(5*1024*1024,1))},5)`,['--memory-mb','64']);assert.equal(memory.status,'memory_budget_exceeded',JSON.stringify(memory));
});
test('SANDBOX child cannot leave an orphan process after exit',()=>{
  const result=run(`require('node:child_process').spawn(process.execPath,['-e','while(true){}'],{stdio:'ignore'});process.exit(0)`);
  assert.equal(result.status,'passed',result.output);assert.equal(result.process_group_killed,true);assert.ok(result.duration_ms<5000);
});
