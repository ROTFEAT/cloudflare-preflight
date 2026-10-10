import {validate} from './schema.mjs';

// Review obligations, not a termination proof. Keep names, dates and incident
// patterns out of discovery: use reachable entries, operations and control flow.
export function executionBounds(ast) {
  const result=[];
  for(const fn of ast.functions.filter(f=>ast.reachable.has(f.id)&&
    (f.entry||f.kind==='module'||['alarm','constructor','onStart','rpc'].includes(f.entry_type)))) {
    const closure=ast.descendants(fn.id);
    const operations=ast.operations.filter(o=>closure.has(o.owner));
    const loops=ast.functions.some(f=>closure.has(f.id)&&f.facts.loops.length);
    const recursive=ast.calls.some(c=>c.kind==='local_call'&&closure.has(c.from)&&ast.descendants(c.to).has(c.from));
    if(!operations.length&&!loops&&!recursive)continue;
    const methods=new Set(operations.map(o=>o.method));
    const continuation=['setAlarm','send','sendBatch','setInterval'].some(m=>methods.has(m));
    const background=['alarm','scheduled','queue'].includes(fn.entry_type);
    const cumulative=continuation||background||recursive;
    const scenarios=new Set(['normal','no_progress','amplification']);
    if(cumulative||loops)scenarios.add('exhaustion');
    if(fn.className||background||continuation)for(const s of ['restart','replay'])scenarios.add(s);
    if(background||continuation)scenarios.add('stop');
    if(methods.has('setAlarm')||methods.has('setInterval')||fn.entry_type==='scheduled')scenarios.add('time_boundary');
    if(fn.entry_type==='queue')scenarios.add('partial_failure');
    result.push({path_id:fn.id,location:fn.location,entry_type:fn.entry_type||fn.kind,
      operation_ids:operations.map(o=>o.id),requires_cumulative_bound:cumulative,
      required_scenarios:[...scenarios]});
  }
  return result;
}

export function executionBoundsGaps(report,texts) {
  const expected=report.coverage.execution_bounds||[];
  if(!expected.length)return [];
  const records=report.tests.filter(t=>t.id==='execution-bounds'&&t.status==='passed'&&t.input_digest===report.deployment_identity.digest);
  if(records.length!==1)return ['execution_bounds:one_current_application_test_required'];
  const metrics=records[0].metrics;
  try{validate('execution-bounds',metrics);}catch{return ['execution_bounds:invalid_test_metrics'];}
  const paths=metrics.paths,gaps=[];
  if(paths.length!==expected.length||new Set(paths.map(p=>p.path_id)).size!==expected.length||paths.some(p=>!expected.some(e=>e.path_id===p.path_id)))return ['execution_bounds:missing_duplicate_or_unknown_path'];
  for(const obligation of expected) {
    const proof=paths.find(p=>p.path_id===obligation.path_id);
    const fail=reason=>gaps.push(`execution_bounds:${reason}:${obligation.path_id}`);
    if(obligation.requires_cumulative_bound&&proof.scope==='invocation')fail('cross_event_scope_required');
    if(obligation.required_scenarios.some(s=>!proof.observations.some(o=>o.scenario===s)))fail('required_scenario_missing');
    for(const observation of proof.observations) {
      if(observation.events>proof.max_events)fail('event_bound_exceeded');
      const units=Object.keys(proof.work_limits);
      if(Object.keys(observation.work).length!==units.length||units.some(unit=>!(unit in observation.work)||observation.work[unit]>proof.work_limits[unit]))fail('work_bound_missing_or_exceeded');
    }
    if(texts&&proof.enforcement.some(e=>{
      const source=texts.get(e.path),text=typeof source==='string'?source:source?.text;
      return text===undefined||e.start_line>text.split('\n').length||e.end_line&&(e.end_line<e.start_line||e.end_line>text.split('\n').length);
    }))fail('enforcement_location_invalid');
  }
  return [...new Set(gaps)];
}
