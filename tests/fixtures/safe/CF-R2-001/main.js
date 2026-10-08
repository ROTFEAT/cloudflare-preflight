export default {async scheduled(ctrl,env){if(!await isChanged())return;await env.BUCKET.put("backup",await changedData())}};
