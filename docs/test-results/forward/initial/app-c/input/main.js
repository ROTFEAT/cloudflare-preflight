export default {async fetch(req,env){await env.DB.prepare("UPDATE jobs SET status=?").bind("done").run();return new Response("ok")}};
