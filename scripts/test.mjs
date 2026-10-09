#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const output=path.resolve('.cost-safety/test-results');fs.mkdirSync(output,{recursive:true});
const files=directories=>directories.flatMap(dir=>fs.readdirSync(dir).filter(f=>f.endsWith('.test.mjs')).sort().map(f=>`${dir}/${f}`));
const stages=[
  ['unit-integration',[process.execPath,'--test','--test-concurrency=1',...files(['tests/unit','tests/integration'])],90000],
  ['workerd',['python3','scripts/sandbox.py','--runtime','--timeout','50','--',process.execPath,'node_modules/vitest/vitest.mjs','run','--configLoader','native'],60000],
  ['package',[process.execPath,'scripts/check-package.mjs'],60000]
];
const records=[];
for(const [name,command,timeout] of stages) {
  process.stdout.write(`Running ${name}…\n`);const started=performance.now();
  const result=spawnSync(command[0],command.slice(1),{encoding:'utf8',timeout,maxBuffer:1024*1024,env:{PATH:process.env.PATH,HOME:'/nonexistent',CI:'true',WRANGLER_SEND_METRICS:'false'}});
  const log=path.join(output,`${name}.log`);fs.writeFileSync(log,`${result.stdout||''}${result.stderr||''}${result.error?`\n${result.error.message}\n`:''}`);
  const record={name,command,exit_code:result.status,duration_ms:Math.round(performance.now()-started),log,status:result.status===0&&!result.error?'passed':'failed'};records.push(record);
  process.stdout.write(`${record.status}: ${log}\n`);
  if(record.status!=='passed'){process.stdout.write(fs.readFileSync(log,'utf8'));break;}
}
fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify({ran_at:new Date().toISOString(),node:process.version,records,passed:records.length===stages.length&&records.every(r=>r.status==='passed')},null,2)+'\n');
if(records.length!==stages.length||records.some(r=>r.status!=='passed'))process.exitCode=1;
