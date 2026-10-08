export default {async fetch(req,env){return Response.json(await env.DB.prepare("SELECT id FROM jobs WHERE status=? ORDER BY id LIMIT 1").bind("pending").all())}};
