import {DurableObject} from "cloudflare:workers";
export class Task extends DurableObject {
constructor(ctx,env){super(ctx,env);this.ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS jobs(id INTEGER PRIMARY KEY, status TEXT, done INTEGER, value INTEGER)");this.ctx.storage.setAlarm(Date.now()+60000)}
activate(){}
attempts=0;async runJob(){await this.ctx.storage.put("work",1)}async alarm(){if(this.attempts++>=3)return;try{await this.runJob()}catch{this.attempts=0}await this.ctx.storage.setAlarm(Date.now()+60000)}
}
export default {async fetch(req,env){await env.TASKS.getByName("shared").activate();return new Response("ok")}};
