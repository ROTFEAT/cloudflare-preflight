export default {async fetch(req,env){return new Response(await env.KV.get("specific-key")||"missing")}};
