export default {async queue(batch){for(const msg of batch.messages){await fetch("https://external.invalid/payment");msg.ack()}}};
