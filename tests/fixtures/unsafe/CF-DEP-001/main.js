import {DurableObject} from "cloudflare:workers";
export class Task extends DurableObject {
constructor(ctx,env){super(ctx,env);this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, status TEXT, done INTEGER, value INTEGER)");this.ctx.storage.setAlarm(Date.now()+60000)}
activate(){}
async alarm(){await this.ctx.storage.setAlarm(Date.now()+60000)}
}
export default {async fetch(req,env){const id=env.TASKS.newUniqueId();await env.TASKS.get(id).activate();return new Response("created")}};
