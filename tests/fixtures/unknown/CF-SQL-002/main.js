export default {async fetch(req,env){await env.DB.prepare("UPDATE jobs SET done=1 WHERE status=?").bind("pending").run();return new Response("ok")}};
