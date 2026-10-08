import ts from 'typescript';
import { asset,json,digest } from './core.mjs';
import { guardsReturn,literal,boundedLoop } from './ast.mjs';
import { predicateColumns,tautology } from './sql.mjs';

export const catalog=()=>json(asset('rules/catalog.json'));
const writes=new Set(['put','delete','run','send','sendBatch','exec']);
export function evaluateRules(ast,config,sql,texts,policy={}) {
  const registry=catalog();
  const ops=ast.operations.filter(o=>ast.reachable.has(o.owner));
  const byOwner=id=>ops.filter(o=>ast.descendants(id).has(o.owner));
  const owners=ast.functions.filter(f=>ast.reachable.has(f.id));
  const getOwner=op=>owners.find(f=>f.id===op.owner);
  const alarms=owners.filter(f=>f.name==='alarm');
  const hasDO=config.bindings.some(b=>b.kind==='durable_object')||ast.classes.some(c=>/DurableObject|Agent/.test(c.base))||ops.some(o=>o.method==='setAlarm');
  const hasQueue=config.bindings.some(b=>b.kind.startsWith('queue'))||owners.some(f=>f.name==='queue');
  const results=registry.rules.map(rule=>({rule_id:rule.id,status:'not_applicable',evidence:[{kind:'inventory_and_call_graph',detail:'No applicable reachable operation in the selected source/configuration'}],findings:[],gaps:[],implementation:rule.implementation}));
  const result=id=>results.find(r=>r.rule_id===id);
  function applies(id, evidence) {const r=result(id);if(r.status==='not_applicable'){r.status='pass';r.evidence=[];} if(evidence)r.evidence.push(evidence);return r;}
  function unknown(id,reason,evidence) {const r=applies(id,evidence);if(r.status!=='finding')r.status='unknown';r.gaps.push({reason,...(evidence?.location?{location:evidence.location}:{})});}
  function finding(id,op,summary,{status='BLOCK',severity='high',detail=null,assumptions=[]}={}) {
    const rule=registry.rules.find(r=>r.id===id),r=applies(id,{location:op.location});
    r.status='finding';
    const fn=getOwner(op);
    const path=fn?[fn.entry_type||fn.name,...byOwner(fn.id).filter(o=>o.id===op.id||['setAlarm','send','sendBatch'].includes(o.method)).map(o=>o.method)]:[id];
    const f={id:`${id}:${digest({location:op.location,summary}).slice(0,12)}`,rule_id:id,origin:'cost_safety',severity,confidence:'high_for_supported_pattern',status,location:op.location,summary,execution_path:path,usage_assessment:{classification:status==='BLOCK'?'unbounded_path':'unknown',units:rule.units,usd_estimate:null,assumptions,excluded:['fixed charges','storage duration','logs/traces','external AI','DO active duration']},native_control_limit:rule.native_control_limit,recommendation:rule.recommendation,evidence:{ast:true,detail,case_ids:rule.case_ids,source_ids:rule.source_ids,tests:[]}};
    r.findings.push(f);return f;
  }
  const durableGuard=fn=>guardsReturn(fn,/(?:attempt|progress|pending|job|hops|window|budget|count)/i)&&byOwner(fn.id).some(o=>o.binding?.kind==='do_storage'&&o.method==='get'&&/^(?:attempts?|progress|pending|job|hops|window|budget|count)$/i.test(literal(o.args[0])||''));
  if(ast.imports.some(i=>/drizzle|kysely|prisma|typeorm|sequelize/i.test(i.spec))&&config.bindings.some(b=>b.kind==='d1'))for(const id of ['CF-SQL-001','CF-SQL-002'])unknown(id,'ORM adapter/source cannot establish the executed SQL, schema or billable rows');

  if(hasDO) {
    for(const id of ['CF-DO-001','CF-DO-002'])applies(id,{kind:'durable_object_lifecycle'});
    if(config.bindings.some(b=>b.kind==='durable_object'&&!ast.activatedClasses.some(c=>c.className===b.config.class_name)))for(const id of ['CF-DO-001','CF-DO-002'])unknown(id,'Declared DO namespace has no proven activation in the local call graph; external callers or previously scheduled alarms require evidence');
    if(!alarms.length&&ast.imports.some(i=>/agent|scheduler/i.test(i.spec)))for(const id of ['CF-DO-001','CF-DO-002'])unknown(id,'External SDK lifecycle or scheduler implementation is not available');
    for(const fn of alarms) {
      const children=byOwner(fn.id),schedules=children.filter(o=>o.method==='setAlarm');
      const billable=children.filter(o=>o.binding&&['exec','get','put','list'].includes(o.method));
      for(const schedule of schedules) {
        const initializers=owners.filter(f=>f.className===fn.className&&['constructor','onStart'].includes(f.name));
        const startsOnActivation=initializers.some(f=>byOwner(f.id).some(o=>o.method==='setAlarm'));
        const schemasKnown=billable.every(o=>o.method!=='exec'||sql.queries.filter(q=>q.id===o.id).some(q=>q.status==='parsed'&&q.statements.every(s=>!s.from?.[0]?.table||sql.schemaFor(q).tables.has(s.from[0].table))));
        if(!durableGuard(fn)&&billable.length&&startsOnActivation&&schemasKnown)finding('CF-DO-001',schedule,'Object activation starts an alarm that performs storage work and schedules another alarm without a durable work boundary',{detail:'Proven stub RPC → constructor → alarm → storage → setAlarm; getAlarm only prevents overlapping schedules',assumptions:['Class lifecycle follows the local implementation','Storage operations remain reachable on repeated activations']});
        else if(!durableGuard(fn))unknown('CF-DO-001','Alarm rescheduling needs a verified work or time-window boundary',{location:schedule.location});
        const cls=ast.classes.find(c=>c.file===fn.file&&c.name===fn.className);
        const resets=cls?.fields.some(f=>/attempt|count|budget/i.test(f.name)&&f.initial==='0')||initializers.some(f=>f.facts.assignments.some(a=>/attempt|count|budget/i.test(a.left.getText())&&a.right.getText()==='0'));
        if(resets&&!durableGuard(fn))finding('CF-DO-002',schedule,'In-memory attempts reset on reactivation while application-created alarms continue the logical task',{detail:'A class field/constructor initializes the counter and no durable cumulative guard is visible'});
        else if(!durableGuard(fn))unknown('CF-DO-002','No verified cumulative logical-job or periodic-window budget',{location:schedule.location});
      }
    }
  }
  const allocations=ops.filter(o=>o.method==='newUniqueId');
  if(hasDO||config.environments?.length)applies('CF-DEP-001',{kind:'effective_environments',environments:config.environments||[],note:'Preview URLs are not assumed to create namespaces'});
  for(const op of allocations) {
    const fn=getOwner(op);
    if(alarms.some(a=>byOwner(a.id).some(o=>o.method==='setAlarm'))&&!guardsReturn(fn,/tenant|instance|quota|limit|budget/i))finding('CF-DEP-001',op,'A reachable request creates a new object identity and the object keeps background alarms alive without an instance lifetime bound');
    else unknown('CF-DEP-001','Object identity cardinality and active lifetime need verified limits',{location:op.location});
  }
  if(config.gaps.some(g=>/template|environment|dynamic/.test(g.reason)))unknown('CF-DEP-001','Final generated environment and binding relationship unresolved');

  for(const q of sql.queries) {
    if(q.status!=='parsed') {for(const id of ['CF-SQL-001','CF-SQL-002'])unknown(id,q.status,{location:q.location});continue;}
    for(const s of q.statements) {
      if(s.type==='select') {
        applies('CF-SQL-001',{location:q.location,kind:'parsed_sql'});
        const table=s.from?.[0]?.table,cols=predicateColumns(s.where),order=(s.orderby||[]).flatMap(o=>predicateColumns(o.expr));
        const schema=sql.schemaFor(q),indexed=schema.indexes.some(i=>i.table===table&&cols.includes(i.columns[0]));
        const hot=ast.entries.filter(e=>['fetch','alarm','queue','scheduled','rpc'].includes(e.entry_type)).some(e=>ast.descendants(e.id).has(q.owner));
        if(hot&&cols.length&&order.length&&!indexed&&schema.tables.has(table)&&!sql.gaps.length)finding('CF-SQL-001',q,'A hot query filters an unindexed column and sorts before LIMIT; returned rows do not bound scanned rows',{detail:'SQL AST and database-specific schema have no matching predicate index; local plans/row metrics must validate the workload',assumptions:['Committed schema describes this database, not another backend','The table can grow beyond the returned result size']});
        else if(!schema.tables.has(table)||!schema.known)unknown('CF-SQL-001','Database-specific schema/index initialization is unavailable',{location:q.location});
        else if(!indexed&&cols.length)unknown('CF-SQL-001','Query selectivity, plan, and runtime row metrics need measurement',{location:q.location});
        else if(s.joins||s.from?.length>1)unknown('CF-SQL-001','JOIN cardinality is outside the narrow static proof',{location:q.location});
      }
      if(['update','delete','insert','replace'].includes(s.type)) {
        applies('CF-SQL-002',{location:q.location,kind:'parsed_sql'});
        const hot=ast.entries.filter(e=>['fetch','alarm','queue','rpc'].includes(e.entry_type)).some(e=>ast.descendants(e.id).has(q.owner));
        const table=s.table?.[0]?.table||s.from?.[0]?.table;
        if(['update','delete'].includes(s.type)&&(!s.where||tautology(s.where))) {
          if(sql.schemaFor(q).tables.has(table))finding('CF-SQL-002',q,'Reachable SQL writes every row because its predicate is absent or always true',{status:hot?'BLOCK':'REVIEW',detail:'SQL parser and database-specific schema confirm UPDATE/DELETE scope; a bounded authorized maintenance task needs explicit review'});
          else unknown('CF-SQL-002','Whole-table mutation candidate has no verified database-specific schema',{location:q.location});
        }
        else if(s.where&&predicateColumns(s.where).length&&!predicateColumns(s.where).some(c=>c==='id'||c.endsWith('_id')))unknown('CF-SQL-002','WHERE selectivity is not an effective row-write bound without a workload contract',{location:q.location});
      }
    }
  }
  for(const fn of owners.filter(f=>['scheduled','alarm'].includes(f.name))) {
    const qs=sql.queries.filter(q=>ast.descendants(fn.id).has(q.owner));
    const batch=qs.find(q=>q.statements.some(s=>s.type==='select'&&s.limit));
    if(!batch)continue;
    applies('CF-JOB-001',{location:fn.location});
    const persistent=byOwner(fn.id).some(o=>o.binding?.kind==='do_storage'&&['put','delete'].includes(o.method)&&/cursor|progress|pending/i.test(literal(o.args[0])||'')) || qs.some(q=>q.statements.some(s=>['update','delete'].includes(s.type)&&(s.type==='delete'||s.set?.some(c=>/processed|cursor|progress|done/.test(c.column)))));
    if(qs.some(q=>q.statements.some(s=>['insert','update','replace'].includes(s.type)))&&!persistent)finding('CF-JOB-001',batch,'Scheduled processing rereads a fixed first batch without committing progress across runs',{detail:'Recurring entry + SELECT LIMIT + writes; no durable cursor or completed-row transition is visible'});
    else if(persistent)unknown('CF-JOB-001','Checkpoint transaction/crash window requires bounded local fault injection',{location:fn.location});
    else unknown('CF-JOB-001','External processing or checkpoint semantics cannot establish durable batch progress',{location:fn.location});
  }
  for(const fn of owners.filter(f=>f.name==='queue')) {
    applies('CF-Q-001',{location:fn.location});applies('CF-Q-002',{location:fn.location});
    const children=byOwner(fn.id),sends=children.filter(o=>['send','sendBatch'].includes(o.method)&&o.binding?.kind==='queue_producer');
    for(const send of sends) {
      const body=send.args[0];
      const fields=body&&ts.isObjectLiteralExpression(body)?body.properties.map(p=>p.name?.getText()).filter(Boolean):[];
      const guard=guardsReturn(fn,/hops\s*[>=]+\s*\d+/)&&fields.includes('rootJobId')&&fields.includes('hops');
      if(!guard)finding('CF-Q-001',send,'Queue consumption reaches a producer that sends a new message without a preserved, enforced logical-task hop bound',{detail:'Cross-file call graph links consumer to producer; max_retries applies to each delivered message, not the new chain'});
      else unknown('CF-Q-001','Persistent logical-task identity, fanout and DLQ replay still need semantic/runtime verification',{location:send.location});
    }
    if(ast.gaps.some(g=>g.owner&&ast.descendants(fn.id).has(g.owner)&&g.reason==='external_or_dynamic_endpoint')) {
      unknown('CF-Q-001','External consumer endpoint may produce new messages');
      unknown('CF-Q-002','External side-effect idempotency and duplicate cost contract unavailable');
    }
    const billable=children.filter(o=>o.binding&&writes.has(o.method));
    const explicitBatchRetry=fn.facts.calls.some(c=>ts.isPropertyAccessExpression(c.expression)&&c.expression.name.text==='retryAll');
    const perItemAck=fn.facts.calls.some(c=>ts.isPropertyAccessExpression(c.expression)&&c.expression.name.text==='ack');
    if(billable.length&&explicitBatchRetry&&!perItemAck)finding('CF-Q-002',billable[0],'A whole-batch retry repeats already completed billable work without per-item acknowledgement or a verified idempotent side-effect boundary',{detail:'Billable side effects precede retryAll; platform retry defaults remain finite but do not eliminate duplicate work'});
    else if(billable.length)unknown('CF-Q-002','Write-before-ack, partial failure, default retry scope and DLQ replay require fault-injection evidence',{location:fn.location});
  }
  if(hasQueue&&!owners.some(f=>f.name==='queue')&&config.bindings.some(b=>b.kind==='queue_consumer'))for(const id of ['CF-Q-001','CF-Q-002'])unknown(id,'Configured consumer handler not resolved');

  for(const op of ops.filter(o=>o.binding?.kind==='kv'&&o.method==='list')) {
    applies('CF-KV-001',{location:op.location});const fn=getOwner(op);
    const advances=fn.facts.assignments.some(a=>/(?:cursor)$/.test(a.left.getText())&&/\.cursor$/.test(a.right.getText())&&a.left.getText()!==a.right.getText());
    if(op.loops.some(l=>!boundedLoop(l))&&!advances)finding('CF-KV-001',op,'KV pagination repeatedly lists without advancing its cursor or enforcing a page budget');
    else if(!op.loops.length||!op.loops.every(boundedLoop))unknown('CF-KV-001','KV miss fallback frequency and page/item totals need verified limits',{location:op.location});
  }
  const r2=ops.filter(o=>o.binding?.kind==='r2');
  for(const op of r2) {
    applies('CF-R2-001',{location:op.location});
    const rate=ops.find(o=>o.method==='setInterval'&&o.args[1]&&ts.isNumericLiteral(o.args[1])&&Number(o.args[1].text)<=1000&&ast.descendants(o.owner).has(op.owner));
    const fn=getOwner(op);
    const alarmRate=fn.name==='alarm'&&byOwner(fn.id).find(o=>o.method==='setAlarm'&&o.args[0]&&ts.isBinaryExpression(o.args[0])&&ts.isNumericLiteral(o.args[0].right)&&Number(o.args[0].right.text)<=1000);
    if(['put','list'].includes(op.method)&&(rate||alarmRate)&&!guardsReturn(fn,/changed|dirty|etag|version/i))finding('CF-R2-001',op,'An unconditional one-second-or-faster timer creates repeated R2 Class A operations even without data changes',{detail:'Reachable timer/alarm period and Class A operation; requests are separate from storage and egress'});
    else unknown('CF-R2-001','Effective synchronization interval, change detection, retry budget and all environments need verification',{location:op.location});
  }
  for(const fn of owners.filter(f=>f.name==='fetch'&&f.entry)) {
    const costly=byOwner(fn.id).filter(o=>o.binding&&['d1','do_storage','kv','r2','queue_producer'].includes(o.binding.kind));
    if(!costly.length)continue;
    applies('CF-HTTP-001',{location:fn.location});
    const polling=ops.find(o=>o.method==='setInterval'&&ast.publicClientFiles.has(o.location.path)&&o.args[1]&&ts.isNumericLiteral(o.args[1])&&Number(o.args[1].text)<=1000&&byOwner(o.owner).some(c=>c.method==='fetch'&&/^\/(?!\/)/.test(literal(c.args[0])||'')));
    const limiter=byOwner(fn.id).some(o=>o.method==='limit')&&guardsReturn(fn,/success|allowed|limit/i);
    if(polling&&!limiter)finding('CF-HTTP-001',costly[0],'Fast client polling reaches a public Worker with downstream billable work; client pacing and an in-Worker cache do not limit Worker invocations',{detail:'Client timer ≤1 second + reachable public handler + resource calls; no server admission guard found'});
    else if(!limiter)unknown('CF-HTTP-001','Public entry/WAF/cache/admission scope cannot be verified from this repository',{location:fn.location});
    else unknown('CF-HTTP-001','Native local rate-limit scope is not an account-wide cap; verify route and background gaps',{location:fn.location});
  }
  applies('CF-SAFE-001',{kind:'control_claims_checked'});
  for(const [file,text] of texts)if(file.endsWith('cost-controls.json')) {
    let controls;try{controls=JSON.parse(text);}catch{unknown('CF-SAFE-001','Control claims JSON is malformed');continue;}
    for(const claim of controls.claims||[]) {
      const invalid=claim.hard_monthly_cap===true&&['budget_alert','cpu_limit','queue_retries'].includes(claim.control)||claim.control==='queue_pause'&&claim.stops_producers===true||claim.control==='deleteAlarm'&&claim.surface==='account_management'||claim.control==='test_reset'&&claim.production===true;
      if(invalid)finding('CF-SAFE-001',{location:{path:file,start_line:1,end_line:1}},'A declared safety guarantee exceeds the documented control scope',{detail:'Structured control assertion conflicts with verified native mechanism'});
      else if(claim.source_verified!==true)unknown('CF-SAFE-001','Control depends on an unverified plan, contract, version or source',{location:{path:file,start_line:1,end_line:1}});
    }
  }
  for(const op of ops.filter(o=>o.method==='abortAllDurableObjects'))finding('CF-SAFE-001',op,'A test-only Durable Object reset helper is reachable from production code and cannot isolate an account');
  if(policy.money_budget?.monthly_usd)unknown('CF-SAFE-001','Monetary budget is declared, not enforced; listed evidence needs semantic validation and cannot establish a monthly hard cap');
  for(const gap of ast.gaps.filter(g=>g.reason==='typescript_parse_error'))for(const r of results)unknown(r.rule_id,'Source parse error prevents complete coverage',{location:{path:gap.path,start_line:1,end_line:1}});
  return {results,findings:results.flatMap(r=>r.findings)};
}
