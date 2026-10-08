export default {async fetch(req,env){return Response.json(await env.DB.prepare("SELECT id FROM jobs WHERE id=1").all())}};
