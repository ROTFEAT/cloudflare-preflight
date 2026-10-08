import {DurableObject} from "cloudflare:workers";
export class Task extends DurableObject {
async fetch(){return new Response("idle")}}
export default {async fetch(req,env){return env.TASKS.getByName("shared").fetch(req)}};
