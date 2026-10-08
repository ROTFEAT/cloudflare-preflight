export default {async queue(batch,env){for(const msg of batch.messages){await fetch("https://external.invalid/jobs",{method:"POST",body:JSON.stringify(msg.body)});msg.ack()}}};
