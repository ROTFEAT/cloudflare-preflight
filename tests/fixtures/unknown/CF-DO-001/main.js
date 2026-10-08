import {Agent} from "agents"; export class Task extends Agent {async onStart(){await this.scheduler.start()}}
export default {fetch(){return new Response("ok")}};
