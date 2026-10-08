export default {async fetch(req,env){return Response.json(await env.DB.prepare(buildDynamicSQL(req)).all())}};
