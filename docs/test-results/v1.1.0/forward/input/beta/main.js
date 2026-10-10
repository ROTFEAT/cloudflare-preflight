import {DurableObject} from 'cloudflare:workers';
export class Cell extends DurableObject {
  async begin(){if(await this.ctx.storage.get('ledger'))return;await this.ctx.storage.put('ledger',{remaining:3,closed:false});await this.ctx.storage.setAlarm(Date.now()+120000);}
  async alarm(){await this.ctx.storage.transaction(async storage=>{const record=await storage.get('ledger');if(!record||record.closed)return;record.remaining--;record.closed=record.remaining<=0;await storage.put('ledger',record);if(record.closed)await storage.deleteAlarm();else await storage.setAlarm(Date.now()+120000);});}
}
export default {async fetch(request,env){await env.CELLS.getByName('one').begin();return new Response('started');}};
