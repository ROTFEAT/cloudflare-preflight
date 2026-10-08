export default {async fetch(req,env){const page=await env.KV.list({prefix:req.headers.get("prefix")});return Response.json(page)}};
