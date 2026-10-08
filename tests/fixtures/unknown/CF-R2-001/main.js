export default {async scheduled(ctrl,env){await env.BUCKET.put("backup",await sdkSnapshot())}};
