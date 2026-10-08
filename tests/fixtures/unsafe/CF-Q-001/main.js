import {enqueue} from "./producer.js"; export default {async queue(batch,env){for(const msg of batch.messages){await enqueue(msg.body,env);msg.ack()}}};
