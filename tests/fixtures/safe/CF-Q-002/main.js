export default {async queue(batch,env){for(const msg of batch.messages){await env.DB.prepare("UPDATE jobs SET done=1 WHERE id=? AND done=0").bind(msg.body.id).run();msg.ack()}}};
