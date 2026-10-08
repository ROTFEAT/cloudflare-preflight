import {DurableObject} from "cloudflare:workers";
export class Task extends DurableObject {
constructor(ctx,env){super(ctx,env);this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, status TEXT, done INTEGER, value INTEGER)");this.ctx.storage.setAlarm(Date.now()+60000)}
activate(){}
async alarm(){await this.env.BUCKET.put("backup","unchanged");await this.env.BUCKET.list();await this.ctx.storage.setAlarm(Date.now()+1000)}
}
export default {async fetch(req,env){await env.TASKS.getByName("shared").activate();return new Response("ok")}};
