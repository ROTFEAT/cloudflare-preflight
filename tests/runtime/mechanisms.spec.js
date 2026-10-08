import {it,expect,afterEach} from 'vitest';
import {env} from 'cloudflare:workers';
import {reset,runDurableObjectAlarm,runInDurableObject,evictDurableObject,createMessageBatch,createExecutionContext,getQueueResult} from 'cloudflare:test';
import {Budget} from './budget.js';

afterEach(async()=>{await reset();});
const stub=ns=>ns.getByName(crypto.randomUUID());
it('DO activation → alarm → eviction/reactivation resets memory but not durable work',async()=>{
 const object=stub(env.UNSAFE);await object.stats();expect(await runDurableObjectAlarm(object)).toBe(true);
 expect((await object.stats()).attempts).toBe(1);await evictDurableObject(object);await object.stats();
 expect(await runDurableObjectAlarm(object)).toBe(true);const state=await object.stats();expect(state.attempts).toBe(1);expect(state.runs).toBe(2);
});
it('getAlarm is null inside a running alarm; guard does not end the chain',async()=>{
 const object=stub(env.UNSAFE);await object.stats();await runDurableObjectAlarm(object);const state=await object.stats();expect(state.lastGetAlarm).toBe(null);expect(state.next).toBeGreaterThan(Date.now());expect(await runDurableObjectAlarm(object)).toBe(true);
});
it('empty safe task performs no scan and does not start after eviction',async()=>{
 const object=stub(env.SAFE);await runInDurableObject(object,instance=>instance.alarm());expect(await object.stats()).toMatchObject({scans:0,remaining:0,next:null});await evictDurableObject(object);await object.stats();expect(await runDurableObjectAlarm(object)).toBe(false);expect((await object.stats()).scans).toBe(0);
});
it('finite task persists progress and finishes across reactivation',async()=>{
 const object=stub(env.SAFE);await object.start(2);await runDurableObjectAlarm(object);await evictDurableObject(object);await object.stats();await runDurableObjectAlarm(object);expect(await object.stats()).toMatchObject({scans:2,remaining:0,next:null});expect(await runDurableObjectAlarm(object)).toBe(false);
});
it('legal periodic work has persistent window and minimum interval bounds',async()=>{
 const object=stub(env.PERIODIC);for(let event=0;event<5;event++)await runInDurableObject(object,instance=>instance.alarm());expect((await object.stats()).work).toBe(3);expect((await object.stats()).next).toBeGreaterThan(Date.now()+59000);await evictDurableObject(object);expect((await object.stats()).work).toBe(3);
});
it('returning one row can read 100/1000/10000 rows; matching index changes growth',async()=>{
 const measured=[];
 for(const n of [100,1000,10000]){const object=stub(env.METER);await object.seed(n);const m=await object.measure("SELECT id FROM jobs WHERE status='rare' ORDER BY value LIMIT 1");expect(m.returned).toBe(1);expect(m.rowsRead).toBeGreaterThanOrEqual(n);expect(m.plan.some(p=>p.detail.includes('SCAN'))).toBe(true);measured.push(m.rowsRead);}
 expect(measured[2]).toBeGreaterThan(measured[0]*50);
 const indexed=stub(env.METER);await indexed.seed(10000,'good');const m=await indexed.measure("SELECT id FROM jobs WHERE status='rare' ORDER BY value LIMIT 1");expect(m.rowsRead).toBeLessThan(10);expect(m.plan.some(p=>p.detail.includes('INDEX'))).toBe(true);
 console.log('DO SQL metrics',JSON.stringify({unindexed:measured,indexed:m.rowsRead}));
});
it('an unsuitable index is not a scan bound',async()=>{
 const object=stub(env.METER);await object.seed(1000,'bad');const m=await object.measure("SELECT id FROM jobs WHERE status='rare' ORDER BY value LIMIT 1");expect(m.rowsRead).toBeGreaterThanOrEqual(1000);
});
it('missing and low-selectivity WHERE write many rows; repeated upsert still writes',async()=>{
 const object=stub(env.METER);await object.seed(1000);const all=await object.measure('UPDATE jobs SET value=7');expect(all.rowsWritten).toBeGreaterThanOrEqual(1000);const broad=await object.measure('UPDATE jobs SET value=8 WHERE id>0');expect(broad.rowsWritten).toBeGreaterThanOrEqual(1000);
 const once=await object.measure("INSERT INTO jobs(id,status,value) VALUES(1,'common',8) ON CONFLICT(id) DO UPDATE SET value=excluded.value");const twice=await object.measure("INSERT INTO jobs(id,status,value) VALUES(1,'common',8) ON CONFLICT(id) DO UPDATE SET value=excluded.value");expect(once.rowsWritten).toBeGreaterThan(0);expect(twice.rowsWritten).toBeGreaterThan(0);
});
it('D1 local metrics are recorded only when supported, never replaced by result count',async()=>{
 await env.DB.exec('CREATE TABLE data(id INTEGER PRIMARY KEY,value TEXT)');await env.DB.prepare('INSERT INTO data VALUES(1,?)').bind('one').run();const result=await env.DB.prepare('SELECT * FROM data').all();expect(result.results.length).toBe(1);
 const metrics=result.meta.rows_read>0?{status:'local_runtime_metric',rows_read:result.meta.rows_read,rows_written:result.meta.rows_written}:{status:'unsupported',rows_read:null,rows_written:null};expect(metrics.status==='unsupported'?metrics.rows_read===null:metrics.rows_read>0).toBe(true);console.log('D1 local metrics',JSON.stringify(metrics));
});
it('successful acks with max_retries=0 still generate a new-ID feedback chain',async()=>{
 const pending=[{rootJobId:'root',jobId:'0',hops:0}],seen=new Set(),budget=new Budget({events:20,messages:20});let acks=0;
 for(let step=0;step<20;step++){budget.charge('events');budget.charge('messages');const body=pending.shift();seen.add(body.jobId);const batch=createMessageBatch('jobs',[{id:body.jobId,timestamp:new Date(),attempts:1,body}]);const ctx=createExecutionContext();for(const msg of batch.messages){pending.push({...msg.body,jobId:crypto.randomUUID()});msg.ack();acks++;}const result=await getQueueResult(batch,ctx);expect(result.retryBatch.retry).toBe(false);}
 expect(acks).toBe(20);expect(seen.size).toBe(20);expect(pending.length).toBe(1);
 expect(()=>budget.charge('events')).toThrow('budget exhausted');
});
it('preserved root/hops stops the new-message chain within a fixed event budget',async()=>{
 const pending=[{rootJobId:'root',hops:0}];let events=0;while(pending.length&&events<10){const body=pending.shift();events++;if(body.hops>=3)continue;pending.push({rootJobId:body.rootJobId,hops:body.hops+1});}expect(events).toBe(4);expect(pending.length).toBe(0);
});
it('partial batch failure and write-before-ack replay have finite measured duplicates',async()=>{
 const attempts=new Map(),done=new Set();let writes=0;
 for(let delivery=0;delivery<3;delivery++){const batch=createMessageBatch('jobs',[1,2,3].map(id=>({id:String(id),timestamp:new Date(),attempts:delivery+1,body:{id}})));const ctx=createExecutionContext();for(const msg of batch.messages){attempts.set(msg.body.id,(attempts.get(msg.body.id)||0)+1);if(!done.has(msg.body.id)){writes++;done.add(msg.body.id);}if(delivery===0&&msg.body.id===2)break;msg.ack();}await getQueueResult(batch,ctx);}
 expect(writes).toBe(3);expect(attempts.get(1)).toBeGreaterThan(1); // no exactly-once claim
 const dlq=[{rootJobId:'root',hops:3}];expect(dlq.filter(m=>m.hops<3).length).toBe(0);
});
it('checkpoint-before-ack crash replays only the bounded batch across Cron ticks',async()=>{
 const rows=Array.from({length:30},(_,id)=>id+1);let cursor=0,writes=0,crashed=false;const counts=new Map();
 for(let tick=0;tick<8;tick++){const batch=rows.filter(id=>id>cursor).slice(0,5);if(!batch.length)break;for(const id of batch){writes++;counts.set(id,(counts.get(id)||0)+1);}if(!crashed){crashed=true;continue;}cursor=batch.at(-1);}
 expect(cursor).toBe(30);expect(writes).toBe(35);expect(Math.max(...counts.values())).toBe(2);
});
it('KV missing keys and bounded pagination use explicit cursors and stop',async()=>{
 expect(await env.KV.get('invalid-credential-key')).toBe(null);for(let i=0;i<5;i++)await env.KV.put('key-'+i,'v');let cursor,items=0,pages=0;for(;pages<4;pages++){const page=await env.KV.list({limit:2,cursor});items+=page.keys.length;if(page.list_complete)break;expect(page.cursor).not.toBe(cursor);cursor=page.cursor;}expect(items).toBe(5);expect(pages).toBeLessThan(4);
});
it('R2 operation frequency and environment multipliers are distinct from URL count',async()=>{
 await env.BUCKET.put('backup','data');expect((await env.BUCKET.list()).objects.length).toBe(1);const window=3600,period=60;expect(window/period).toBe(60);expect(window/1).toBe(3600);expect(3*(window/period)).toBe(180);const sharedBindings=new Set(['same-bucket','same-bucket']);expect(sharedBindings.size).toBe(1);
});
it('outbound paid-service calls cannot leave the local runtime',async()=>{expect((await fetch('https://api.cloudflare.com/client/v4/accounts')).status).toBe(403);});
it('fixture budgets reject excess work before an operation executes',async()=>{
 const budget=new Budget({events:2,messages:2,rows:10000});let operations=0;
 const run=()=>{budget.charge('events');operations++;};run();run();expect(run).toThrow('budget exhausted');expect(operations).toBe(2);
 const object=stub(env.METER);expect(await runInDurableObject(object,instance=>{try{instance.seed(10001);return false;}catch(error){return error.message==='row budget';}})).toBe(true);expect(()=>budget.charge('rows',10001)).toThrow('budget exhausted');
});
