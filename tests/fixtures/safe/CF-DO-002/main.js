import {DurableObject} from "cloudflare:workers";
export class Task extends DurableObject {
constructor(ctx,env){super(ctx,env);this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, status TEXT, done INTEGER, value INTEGER)");this.ctx.storage.setAlarm(Date.now()+60000)}
activate(){}
async alarm(){const attempts=await this.ctx.storage.get("attempts")||0;if(attempts>=3)return;await this.ctx.storage.put("attempts",attempts+1);await this.ctx.storage.setAlarm(Date.now()+60000)}
}
export default {async fetch(req,env){await env.TASKS.getByName("shared").activate();return new Response("ok")}};
