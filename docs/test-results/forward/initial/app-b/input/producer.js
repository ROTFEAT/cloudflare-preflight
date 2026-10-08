export async function enqueue(body,env){await env.JOBS.send({jobId:crypto.randomUUID(),async:true})}
