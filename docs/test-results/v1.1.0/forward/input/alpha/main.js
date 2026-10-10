import {DurableObject} from 'cloudflare:workers';
const windowMs=5*86400000, marginMs=2*86400000;
export class Cell extends DurableObject {
  async begin(){const record={expires:Date.now()+windowMs,value:1};await this.ctx.storage.put('record',record);await this.plan(record);}
  async plan(record){await this.ctx.storage.setAlarm(Math.max(Date.now(),record.expires-marginMs));}
  async alarm(){const record=await this.ctx.storage.get('record');if(!record)return;await this.ctx.storage.put('record',record);await this.plan(record);}
}
export default {async fetch(request,env){await env.CELLS.getByName('one').begin();return new Response('started');}};
