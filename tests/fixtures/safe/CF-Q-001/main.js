export default {async queue(batch,env){for(const msg of batch.messages){await executeLocally(msg.body);msg.ack()}}};
