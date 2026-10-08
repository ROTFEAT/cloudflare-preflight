import fs from 'node:fs';
import path from 'node:path';
import {writeJSON} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';

const doConfig={durable_objects:{bindings:[{name:'TASKS',class_name:'Task'}]},migrations:[{tag:'v1',new_sqlite_classes:['Task']}]};
const dbConfig={d1_databases:[{binding:'DB',database_id:'synthetic-database',database_name:'fixture'}]};
const qConfig={queues:{producers:[{binding:'JOBS',queue:'jobs'}],consumers:[{queue:'jobs',max_retries:0}]}};
const kvConfig={kv_namespaces:[{binding:'KV',id:'synthetic-kv'}]};
const r2Config={r2_buckets:[{binding:'BUCKET',bucket_name:'synthetic-bucket'}]};
const schema='CREATE TABLE jobs(id INTEGER PRIMARY KEY, status TEXT, done INTEGER, value INTEGER);\n';
const base='export default {fetch(){return new Response("ok")}};\n';
const activate='export default {async fetch(req,env){await env.TASKS.getByName("shared").activate();return new Response("ok")}};\n';
const init='constructor(ctx,env){super(ctx,env);this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, status TEXT, done INTEGER, value INTEGER)");this.ctx.storage.setAlarm(Date.now()+60000)}\nactivate(){}\n';
const head='import {DurableObject} from "cloudflare:workers";\nexport class Task extends DurableObject {\n';
const cases=[
 ['CF-DO-001',doConfig,
  head+init+'async alarm(){this.ctx.storage.sql.exec("SELECT * FROM jobs").toArray();if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+60000)}\n}\n'+activate,
  head+'constructor(ctx,env){super(ctx,env);this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY)")}\nasync activate(){await this.ctx.storage.put("pending",true);await this.ctx.storage.setAlarm(Date.now()+60000)}\nasync alarm(){if(!await this.ctx.storage.get("pending"))return;this.ctx.storage.sql.exec("SELECT * FROM jobs WHERE id=1").toArray();await this.ctx.storage.delete("pending")}\n}\n'+activate,
  'import {Agent} from "agents"; export class Task extends Agent {async onStart(){await this.scheduler.start()}}\n'+base],
 ['CF-DO-002',doConfig,
  head+init+'attempts=0;async runJob(){await this.ctx.storage.put("work",1)}async alarm(){if(this.attempts++>=3)return;try{await this.runJob()}catch{this.attempts=0}await this.ctx.storage.setAlarm(Date.now()+60000)}\n}\n'+activate,
  head+init+'async alarm(){const attempts=await this.ctx.storage.get("attempts")||0;if(attempts>=3)return;await this.ctx.storage.put("attempts",attempts+1);await this.ctx.storage.setAlarm(Date.now()+60000)}\n}\n'+activate,
  head+init+'async alarm(){await unknownScheduler();await this.ctx.storage.setAlarm(Date.now()+60000)}\n}\n'+activate],
 ['CF-DEP-001',doConfig,
  head+init+'async alarm(){await this.ctx.storage.setAlarm(Date.now()+60000)}\n}\nexport default {async fetch(req,env){const id=env.TASKS.newUniqueId();await env.TASKS.get(id).activate();return new Response("created")}};\n',
  head+'async fetch(){return new Response("idle")}}\nexport default {async fetch(req,env){return env.TASKS.getByName("shared").fetch(req)}};\n',
  base],
 ['CF-SQL-001',dbConfig,
  'export default {async fetch(req,env){return Response.json(await env.DB.prepare("SELECT id FROM jobs WHERE status=? ORDER BY id LIMIT 1").bind("pending").all())}};\n',
  'export default {async fetch(req,env){return Response.json(await env.DB.prepare("SELECT id FROM jobs WHERE status=? ORDER BY id LIMIT 1").bind("pending").all())}};\n',
  'export default {async fetch(req,env){return Response.json(await env.DB.prepare(buildDynamicSQL(req)).all())}};\n'],
 ['CF-SQL-002',dbConfig,
  'export default {async fetch(req,env){await env.DB.prepare("UPDATE jobs SET status=?").bind("done").run();return new Response("ok")}};\n',
  'export default {async fetch(req,env){await env.DB.prepare("UPDATE jobs SET status=? WHERE id=?").bind("done",1).run();return new Response("ok")}};\n',
  'export default {async fetch(req,env){await env.DB.prepare("UPDATE jobs SET done=1 WHERE status=?").bind("pending").run();return new Response("ok")}};\n'],
 ['CF-JOB-001',{...dbConfig,triggers:{crons:['* * * * *']}},
  'export default {async scheduled(ctrl,env){const rows=await env.DB.prepare("SELECT id FROM jobs ORDER BY id LIMIT 10").all();for(const row of rows.results)await env.DB.prepare("UPDATE jobs SET value=1 WHERE id=?").bind(row.id).run()}};\n',
  'export default {async scheduled(ctrl,env){const rows=await env.DB.prepare("SELECT id FROM jobs WHERE done=0 ORDER BY id LIMIT 10").all();for(const row of rows.results)await env.DB.prepare("UPDATE jobs SET done=1 WHERE id=?").bind(row.id).run()}};\n',
  'export default {async scheduled(ctrl,env){const rows=await env.DB.prepare("SELECT id FROM jobs ORDER BY id LIMIT 10").all();await externalCheckpoint(rows)}};\n'],
 ['CF-Q-001',qConfig,
  'import {enqueue} from "./producer.js"; export default {async queue(batch,env){for(const msg of batch.messages){await enqueue(msg.body,env);msg.ack()}}};\n',
  'export default {async queue(batch,env){for(const msg of batch.messages){await executeLocally(msg.body);msg.ack()}}};\n',
  'export default {async queue(batch,env){for(const msg of batch.messages){await fetch("https://external.invalid/jobs",{method:"POST",body:JSON.stringify(msg.body)});msg.ack()}}};\n'],
 ['CF-Q-002',{...qConfig,...dbConfig},
  'export default {async queue(batch,env){try{for(const msg of batch.messages){await env.DB.prepare("UPDATE jobs SET value=value+1 WHERE id=?").bind(msg.body.id).run();if(msg.body.fail)throw new Error("last item failed")}}catch{batch.retryAll()}}};\n',
  'export default {async queue(batch,env){for(const msg of batch.messages){await env.DB.prepare("UPDATE jobs SET done=1 WHERE id=? AND done=0").bind(msg.body.id).run();msg.ack()}}};\n',
  'export default {async queue(batch){for(const msg of batch.messages){await fetch("https://external.invalid/payment");msg.ack()}}};\n'],
 ['CF-KV-001',kvConfig,
  'export default {async fetch(req,env){const value=await env.KV.get("missing");if(!value){let cursor="";while(true){const page=await env.KV.list({cursor});if(page.list_complete)break}}return new Response("ok")}};\n',
  'export default {async fetch(req,env){return new Response(await env.KV.get("specific-key")||"missing")}};\n',
  'export default {async fetch(req,env){const page=await env.KV.list({prefix:req.headers.get("prefix")});return Response.json(page)}};\n'],
 ['CF-R2-001',{...r2Config,...doConfig},
  head+init+'async alarm(){await this.env.BUCKET.put("backup","unchanged");await this.env.BUCKET.list();await this.ctx.storage.setAlarm(Date.now()+1000)}\n}\n'+activate,
  'export default {async scheduled(ctrl,env){if(!await isChanged())return;await env.BUCKET.put("backup",await changedData())}};\n',
  'export default {async scheduled(ctrl,env){await env.BUCKET.put("backup",await sdkSnapshot())}};\n'],
 ['CF-HTTP-001',dbConfig,
  'export default {async fetch(req,env){return Response.json(await env.DB.prepare("SELECT id FROM jobs WHERE id=1").all())}};\n',
  base,
  'export default {async fetch(req,env){return Response.json(await env.DB.prepare("SELECT id FROM jobs WHERE id=1").all())}};\n'],
 ['CF-SAFE-001',{},base,base,base]
];
for(const [id,config,...programs] of cases)for(const [index,kind] of ['unsafe','safe','unknown'].entries()) {
 const dir=path.join('tests/fixtures',kind,id);fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(dir,'main.js'),programs[index]);
 const cfg={name:`fixture-${id.toLowerCase()}`,account_id:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',main:'main.js',compatibility_date:'2026-10-08',observability:{enabled:true,traces:{enabled:true}},...structuredClone(config)};
 if(id==='CF-DEP-001'&&kind==='unknown')cfg.durable_objects.bindings[0]={name:'TASKS',class_name:'${GENERATED_CLASS}'};
 writeJSON(path.join(dir,'wrangler.jsonc'),cfg);
 writeJSON(path.join(dir,'package-lock.json'),{name:'synthetic-fixture',lockfileVersion:3,packages:{'node_modules/wrangler':{version:'4.148.0'}}});
 writeJSON(path.join(dir,'expected.json'),{id,kind,assertion:kind==='unsafe'?'corresponding rule BLOCK with reachable source location':kind==='safe'?'no unjustified BLOCK':'corresponding rule unknown with explicit gap',synthetic:true});
 if(config.durable_objects&&!config.d1_databases)fs.rmSync(path.join(dir,'migrations'),{recursive:true,force:true});
 if(Object.keys(config).includes('d1_databases')) {
  fs.mkdirSync(path.join(dir,'migrations'),{recursive:true});
  fs.writeFileSync(path.join(dir,'migrations/0001.sql'),schema+(id==='CF-SQL-001'&&kind==='safe'?'CREATE INDEX jobs_status_id ON jobs(status,id);\n':id==='CF-JOB-001'&&kind==='safe'?'CREATE INDEX jobs_done_id ON jobs(done,id);\n':''));
 }
 if(id==='CF-Q-001'&&kind==='unsafe')fs.writeFileSync(path.join(dir,'producer.js'),'export async function enqueue(body,env){await env.JOBS.send({jobId:crypto.randomUUID(),async:true})}\n');
 if(id==='CF-HTTP-001'&&kind==='unsafe'){fs.mkdirSync(path.join(dir,'public'),{recursive:true});fs.writeFileSync(path.join(dir,'public/index.html'),'<html><body><script src="/client.js"></script></body></html>');fs.writeFileSync(path.join(dir,'public/client.js'),'setInterval(()=>fetch("/api/poll"),1000);');cfg.assets={directory:'public',run_worker_first:true};writeJSON(path.join(dir,'wrangler.jsonc'),cfg);}
 if(id==='CF-SAFE-001')writeJSON(path.join(dir,'cost-controls.json'),{claims:kind==='unsafe'?[{control:'budget_alert',hard_monthly_cap:true}]:kind==='safe'?[{control:'budget_alert',hard_monthly_cap:false,source_verified:true}]:[{control:'enterprise_budget',source_verified:false}]});
}
