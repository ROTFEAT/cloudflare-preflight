export default {async fetch(req,env){await env.DB.prepare("UPDATE jobs SET status=? WHERE id=?").bind("done",1).run();return new Response("ok")}};
