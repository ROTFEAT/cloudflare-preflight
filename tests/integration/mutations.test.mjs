import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {preflight,defaultPolicy} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/preflight.mjs';
import {fixture,temp,opts} from '../helpers.mjs';

const mutations=[
 {name:'remove progress commit',rule:'CF-JOB-001',change:s=>s.replace('SET done=1','SET value=1')},
 {name:'reset attempts on every activation',rule:'CF-DO-002',change:s=>s.replace('const attempts=await this.ctx.storage.get("attempts")||0','const attempts=0').replace('await this.ctx.storage.put("attempts",attempts+1);','this.attempts=0;').replace('export class Task extends DurableObject {','export class Task extends DurableObject {attempts=0;')},
 {name:'drop rootJobId/hops on new message',rule:'CF-Q-001',start:'export default {async queue(batch,env){for(const msg of batch.messages){if(msg.body.hops>=3)return;await env.JOBS.send({rootJobId:msg.body.rootJobId,hops:msg.body.hops+1});msg.ack()}}};',change:s=>s.replace('rootJobId:msg.body.rootJobId,hops:msg.body.hops+1','jobId:crypto.randomUUID()')},
 {name:'remove WHERE',rule:'CF-SQL-002',change:s=>s.replace(' WHERE id=?','')},
 {name:'delete effective index',rule:'CF-SQL-001',file:'migrations/0001.sql',change:s=>s.replace('CREATE INDEX jobs_status_id ON jobs(status,id);','')},
 {name:'stop cursor progress',rule:'CF-KV-001',start:'export default {async fetch(req,env){let cursor="";while(true){const page=await env.KV.list({cursor});if(page.list_complete)break;cursor=page.cursor}return new Response("ok")}};',change:s=>s.replace('cursor=page.cursor','cursor=cursor')},
 {name:'minute sync becomes second sync',rule:'CF-R2-001',start:'import {env} from "cloudflare:workers";setInterval(()=>env.BUCKET.put("backup","data"),60000);export default {fetch(){return new Response("ok")}};',change:s=>s.replace('60000','1000')},
 {name:'unverified budget declaration cannot reuse safety conclusion',rule:'CF-SAFE-001',policy:true}
];
for(const mutation of mutations)test(`MUTATION ${mutation.name}`,()=>{
 const root=temp();fs.cpSync(fixture('safe',mutation.rule),root,{recursive:true});
 if(mutation.start)fs.writeFileSync(path.join(root,'main.js'),mutation.start);
 const before=preflight(opts(root)).report;assert.equal(before.findings.some(f=>f.status==='BLOCK'),false);
 let policy;
 if(mutation.policy){policy=defaultPolicy();policy.money_budget={monthly_usd:20,status:'declared_not_enforced'};}
 else {const file=path.join(root,mutation.file||'main.js');const original=fs.readFileSync(file,'utf8');const changed=mutation.change(original);assert.notEqual(changed,original);fs.writeFileSync(file,changed);}
 const after=preflight({...opts(root),...(policy?{policy}:{})}).report;
 assert.notEqual(after.deployment_identity.digest,before.deployment_identity.digest);
 const rule=after.rules.find(r=>r.rule_id===mutation.rule);assert.ok(['finding','unknown'].includes(rule.status),JSON.stringify(rule));assert.notEqual(after.overall_status,'PASS');
});
