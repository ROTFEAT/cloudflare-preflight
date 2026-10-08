export default {async scheduled(ctrl,env){const rows=await env.DB.prepare("SELECT id FROM jobs ORDER BY id LIMIT 10").all();await externalCheckpoint(rows)}};
