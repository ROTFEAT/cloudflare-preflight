import {DurableObject} from "cloudflare:workers";
export class Task extends DurableObject {
constructor(ctx,env){super(ctx,env);this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY)")}
async activate(){await this.ctx.storage.put("pending",true);await this.ctx.storage.setAlarm(Date.now()+60000)}
async alarm(){if(!await this.ctx.storage.get("pending"))return;this.ctx.storage.sql.exec("SELECT * FROM jobs WHERE id=1").toArray();await this.ctx.storage.delete("pending")}
}
export default {async fetch(req,env){await env.TASKS.getByName("shared").activate();return new Response("ok")}};
