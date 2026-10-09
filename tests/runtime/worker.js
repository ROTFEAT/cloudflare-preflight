import {DurableObject} from 'cloudflare:workers';
const later=()=>Date.now()+3600000;
export class UnsafeTask extends DurableObject {
  attempts=0;
  constructor(ctx,env){super(ctx,env);ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY)');ctx.storage.setAlarm(later());}
  async alarm(){
    this.lastGetAlarm=await this.ctx.storage.getAlarm();
    if(this.attempts++>=2)return;
    this.ctx.storage.sql.exec('SELECT * FROM items').toArray();
    await this.ctx.storage.put('runs',(await this.ctx.storage.get('runs')||0)+1);
    if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(later());
  }
  async stats(){return {attempts:this.attempts,runs:await this.ctx.storage.get('runs')||0,lastGetAlarm:this.lastGetAlarm??null,next:await this.ctx.storage.getAlarm()};}
}
export class SafeTask extends DurableObject {
  constructor(ctx,env){super(ctx,env);ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS items(id INTEGER PRIMARY KEY)');}
  async start(remaining){if(remaining>5)throw new Error('fixture event budget');await this.ctx.storage.put('remaining',remaining);if(remaining)await this.ctx.storage.setAlarm(later());}
  async alarm(){const n=await this.ctx.storage.get('remaining')||0;if(!n)return;
    this.ctx.storage.sql.exec('SELECT * FROM items WHERE id=1').toArray();
    await this.ctx.storage.put('scans',(await this.ctx.storage.get('scans')||0)+1);
    await this.ctx.storage.put('remaining',n-1);if(n>1)await this.ctx.storage.setAlarm(later());else await this.ctx.storage.deleteAlarm();}
  async stats(){return {remaining:await this.ctx.storage.get('remaining')||0,scans:await this.ctx.storage.get('scans')||0,next:await this.ctx.storage.getAlarm()};}
}
export class PeriodicTask extends DurableObject {
  async alarm(){const bucket=Math.floor(Date.now()/3600000);const saved=await this.ctx.storage.get('window');const window=saved?.bucket===bucket?saved:{bucket,count:0};if(window.count<3){window.count++;await this.ctx.storage.put('window',window);await this.ctx.storage.put('work',(await this.ctx.storage.get('work')||0)+1);}await this.ctx.storage.setAlarm(Date.now()+60000);}
  async stats(){return {work:await this.ctx.storage.get('work')||0,next:await this.ctx.storage.getAlarm()};}
}
// Injected time exercises delayed transitions without waiting or using cloud
// resources. "work" counts logical refreshes, not provider billing metrics.
export class RefreshTask extends DurableObject {
  async start(now,stale=false){
    if(!Number.isSafeInteger(now)||now<=0)throw new Error('invalid fixture clock');
    const day=86400000,state={expires:now+30*day,next:now+23*day,last:now,work:0,status:'active',stale};
    await this.ctx.storage.put('checkpoint',state);await this.ctx.storage.setAlarm(state.next);
  }
  async tick(now){
    if(!Number.isSafeInteger(now)||now<=0)throw new Error('invalid fixture clock');
    const state=await this.ctx.storage.get('checkpoint');
    if(!state||state.status!=='active')return {controlReads:1,work:0,rescheduled:false};
    if(now<state.last)throw new Error('backwards fixture clock');
    state.last=now;
    if(now>=state.expires){state.status='expired';await this.ctx.storage.put('checkpoint',state);await this.ctx.storage.deleteAlarm();return {controlReads:1,work:0,rescheduled:false};}
    let work=0;
    if(now>=state.next){state.work++;work=1;if(!state.stale){state.expires=now+30*86400000;state.next=now+23*86400000;}}
    await this.ctx.storage.put('checkpoint',state);await this.ctx.storage.setAlarm(state.next);
    return {controlReads:1,work,rescheduled:true};
  }
  async alarm(){await this.tick(Date.now());}
  async stop(){const state=await this.ctx.storage.get('checkpoint');if(state){state.status='disabled';await this.ctx.storage.put('checkpoint',state);}await this.ctx.storage.deleteAlarm();}
  async stats(){return {...await this.ctx.storage.get('checkpoint'),alarm:await this.ctx.storage.getAlarm()};}
}
export class Meter extends DurableObject {
  seed(n,index='none') {
    if(![100,1000,10000].includes(n))throw new Error('row budget');
    const sql=this.ctx.storage.sql;
    sql.exec('CREATE TABLE jobs(id INTEGER PRIMARY KEY,status TEXT,value INTEGER)');
    sql.exec('WITH RECURSIVE r(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM r WHERE x < ?) INSERT INTO jobs SELECT x, CASE WHEN x=? THEN \'rare\' ELSE \'common\' END, x FROM r',n,n).toArray();
    if(index==='good')sql.exec('CREATE INDEX jobs_status_value ON jobs(status,value)');
    if(index==='bad')sql.exec('CREATE INDEX jobs_value ON jobs(value)');
    return {rows:n,index};
  }
  measure(query,...args) {
    const cursor=this.ctx.storage.sql.exec(query,...args);
    const rows=cursor.toArray(); // Consume before reading cursor metrics.
    return {returned:rows.length,rowsRead:cursor.rowsRead,rowsWritten:cursor.rowsWritten,plan:query.startsWith('SELECT')?this.ctx.storage.sql.exec('EXPLAIN QUERY PLAN '+query,...args).toArray():null};
  }
}
export default {fetch(){return new Response('offline fixtures')}};
