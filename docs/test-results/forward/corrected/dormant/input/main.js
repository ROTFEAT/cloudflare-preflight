import {DurableObject} from "cloudflare:workers";
export class Task extends DurableObject {
constructor(ctx,env){super(ctx,env);this.ctx.storage.setAlarm(Date.now()+60000)}
async alarm(){this.ctx.storage.sql.exec("SELECT * FROM jobs").toArray();if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+60000)}
}
export default {fetch(){return new Response("ok")}};
