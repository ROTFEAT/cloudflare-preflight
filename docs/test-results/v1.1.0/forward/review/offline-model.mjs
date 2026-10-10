import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const [candidate, group] = process.argv.slice(2);
if (!['alpha', 'beta'].includes(candidate) || !['core', 'time', 'fault'].includes(group)) throw Error('fixed_candidate_and_group_required');
const root = '/workspace';
const source = fs.readFileSync(root + '/' + candidate + '/main.js', 'utf8');
const source_digest = crypto.createHash('sha256').update(source).digest('hex');
const maxEvents = 50;
let chargedEvents = 0, chargedFixtures = 0, chargedOperations = 0;
const clock = { now: 1_000_000_000_000 };
const observations = [];
const freshCounts = () => ({worker_invocations:0, rpc_events:0, alarm_events:0, do_get_calls:0, do_put_calls:0, set_alarm_calls:0, delete_alarm_calls:0, transaction_calls:0, transaction_commits:0, transaction_rollbacks:0, stub_lookups:0});
const totalKeys = ['worker_invocations','rpc_events','alarm_events','do_get_calls','do_put_calls','set_alarm_calls','delete_alarm_calls','transaction_calls','transaction_commits','transaction_rollbacks','stub_lookups'];
function event() { if (++chargedEvents > maxEvents) throw Error('harness_event_budget_exhausted'); }
function operation() { if (++chargedOperations > 500) throw Error('harness_operation_budget_exhausted'); }
function fixture() { if (++chargedFixtures > 50) throw Error('harness_fixture_budget_exhausted'); }
const clone = value => value === undefined ? undefined : structuredClone(value);
const snapshotMap = map => new Map([...map].map(([k,v]) => [k, clone(v)]));
class Storage {
  constructor(seed) {
    fixture();
    this.data = new Map(seed ? [seed] : []);
    this.alarmAt = null;
    this.counts = freshCounts();
    this.fault = null;
    this.durablePuts = 0;
  }
  count(key) { operation(); this.counts[key]++; }
  trip(point) { if (this.fault === point) { this.fault = null; throw Error('injected:' + point); } }
  async get(key) { this.count('do_get_calls'); this.trip('before_get'); return clone(this.data.get(key)); }
  async put(key,value) {
    this.count('do_put_calls'); this.trip('before_put');
    this.data.set(key, clone(value));
    if (this.data.size > 1) throw Error('fixture_rows_exhausted');
    this.durablePuts++; this.trip('after_put');
  }
  async setAlarm(at) {
    this.count('set_alarm_calls'); this.trip('before_setAlarm');
    if (typeof at !== 'number' || !Number.isFinite(at)) throw Error('double_rejects_nonfinite_alarm');
    this.alarmAt=at; this.trip('after_setAlarm');
  }
  async deleteAlarm() { this.count('delete_alarm_calls'); this.trip('before_deleteAlarm'); this.alarmAt=null; this.trip('after_deleteAlarm'); }
  async getAlarm() { return this.alarmAt; }
  async transaction(callback) {
    this.count('transaction_calls');
    const outerData=this.data, outerAlarm=this.alarmAt, outerPuts=this.durablePuts;
    this.data=snapshotMap(this.data);
    try { const result=await callback(this); this.counts.transaction_commits++; return result; }
    catch (error) { this.data=outerData; this.alarmAt=outerAlarm; this.durablePuts=outerPuts; this.counts.transaction_rollbacks++; throw error; }
  }
}
class DurableObject { constructor(ctx, env) { this.ctx=ctx; this.env=env; } }
class FakeDate extends Date { static now() { return clock.now; } }
const context=vm.createContext({Date:FakeDate, Response, Request, structuredClone});
const cloudflare=new vm.SyntheticModule(['DurableObject'],function(){this.setExport('DurableObject',DurableObject);},{context});
const mod=new vm.SourceTextModule(source,{context,identifier:candidate+'/main.js'});
await mod.link(specifier => { if (specifier !== 'cloudflare:workers') throw Error('unapproved_import'); return cloudflare; });
await mod.evaluate({timeout:1000});
function make(seed) {
  const storage=new Storage(seed);
  const fixtureObject={storage,cell:null,env:null};
  fixtureObject.cell=new mod.namespace.Cell({storage},{});
  fixtureObject.env={CELLS:{getByName(name) {
    storage.counts.stub_lookups++;
    assert.equal(name,'one');
    return {begin:async()=>{ event(); storage.counts.rpc_events++; return fixtureObject.cell.begin(); }};
  }}};
  return fixtureObject;
}
function restart(f) { f.cell=new mod.namespace.Cell({storage:f.storage},{}); }
async function begin(f) { event(); f.storage.counts.rpc_events++; return f.cell.begin(); }
async function http(f,method='GET',url='https://example.invalid/',headers={}) {
  event(); f.storage.counts.worker_invocations++;
  return mod.namespace.default.fetch(new Request(url,{method,headers}),f.env);
}
async function alarm(f,at=clock.now,consume=true) {
  clock.now=at; event(); f.storage.counts.alarm_events++;
  if (consume) f.storage.alarmAt=null;
  return f.cell.alarm();
}
function observe(scenario,name,f,details={}) {
  const counts={...f.storage.counts};
  observations.push({scenario,case:name,events:counts.worker_invocations+counts.rpc_events+counts.alarm_events,work:counts,record:clone(f.storage.data.get(candidate==='alpha'?'record':'ledger'))??null,pending_alarm:f.storage.alarmAt,durable_puts_in_double:f.storage.durablePuts,sql_rows_read:null,sql_rows_written:null,...details});
}
async function expectInjected(fn,part) { await assert.rejects(fn,error=>error.message.includes(part)); }
const T=1_000_000_000_000, D=86_400_000;
if (candidate==='alpha' && group==='core') {
  clock.now=T; const normal=make(); await begin(normal); assert.equal(normal.storage.alarmAt,T+3*D);
  await alarm(normal,T+3*D); assert.equal(normal.storage.alarmAt,T+3*D); assert.equal(normal.storage.data.get('record').expires,T+5*D);
  observe('normal','first due alarm preserves expiry and schedules the same due timestamp',normal,{safety:'unsafe_feedback'});
  clock.now=T; const repeat=make(); await begin(repeat);
  for(let i=0;i<8;i++) await alarm(repeat,T+3*D);
  assert.equal(repeat.storage.alarmAt,T+3*D); assert.equal(repeat.storage.counts.do_put_calls,9); assert.equal(repeat.storage.counts.set_alarm_calls,9);
  observe('no_progress','eight successful alarm callbacks at the refresh boundary',repeat,{safety:'unsafe_feedback',cutoff:'explicit eight-callback harness cutoff; no application exhaustion'});
  const empty=make(); await alarm(empty,T+3*D); assert.equal(empty.storage.alarmAt,null);
  observe('no_progress','missing record returns after one control read',empty,{safety:'bounded_empty_case'});
  clock.now=T; const reboot=make(); await begin(reboot); restart(reboot); await alarm(reboot,T+3*D); restart(reboot); await alarm(reboot,T+3*D);
  assert.equal(reboot.storage.alarmAt,T+3*D); observe('restart','new object instances use unchanged persisted expiry',reboot,{safety:'unsafe_feedback'});
  clock.now=T; const replay=make(); await begin(replay); clock.now=T+D; await begin(replay); assert.equal(replay.storage.alarmAt,T+4*D);
  await alarm(replay,T+4*D); observe('replay','begin replay overwrites expiry and later alarm still has no progress',replay,{safety:'unsafe_feedback'});
  clock.now=T; const access=make();
  await http(access,'GET','https://example.invalid/arbitrary',{Authorization:'Bearer invalid'});
  clock.now=T+1000; await http(access,'OPTIONS','https://alternate.invalid/another');
  assert.equal(access.storage.counts.do_put_calls,2); assert.equal(access.storage.counts.set_alarm_calls,2);
  observe('amplification','invalid credential GET and arbitrary-host OPTIONS both initiate writes',access,{safety:'unrestricted_request_control_work'});
  const stop=make(['record',{expires:T+5*D,value:1,closed:true,disabled:true}]); await alarm(stop,T+3*D);
  assert.equal(stop.storage.alarmAt,T+3*D); observe('stop','extra persisted closed/disabled fields are ignored',stop,{safety:'no_supported_stop',note:'fields are synthetic negative evidence, not a claimed stop API'});
}
if (candidate==='alpha' && group==='time') {
  for (const offset of [3*D-1,3*D,3*D+1,5*D-1,5*D,5*D+1,8*D]) {
    const f=make(['record',{expires:T+5*D,value:1}]); await alarm(f,T+offset);
    assert.equal(f.storage.alarmAt,Math.max(T+offset,T+3*D));
    observe('time_boundary','forced callback at T+'+offset+'ms',f,{safety:offset>=3*D?'unsafe_due_rearm':'future_rearm',due_boundary_ms:3*D,expiry_boundary_ms:5*D,note:'direct callback probe includes early delivery; it does not assert platform early delivery'});
  }
  const backwards=make(['record',{expires:T+5*D,value:1}]); await alarm(backwards,T+3*D); await alarm(backwards,T+2*D);
  assert.equal(backwards.storage.alarmAt,T+3*D); observe('time_boundary','clock moves backwards after a due callback',backwards,{safety:'unchanged_transition'});
  for(const expires of [Infinity,NaN,undefined]) {
    const f=make(['record',{expires,value:1}]); await expectInjected(()=>alarm(f,T+8*D),'double_rejects_nonfinite_alarm');
    observe('time_boundary','invalid stored expiry '+String(expires),f,{safety:'unknown_platform_fault',note:'double rejects non-finite timestamps; real API/retry handling is unsupported'});
  }
}
if (candidate==='alpha' && group==='fault') {
  clock.now=T; const initial=make(); initial.storage.fault='after_put';
  await expectInjected(()=>begin(initial),'injected:after_put');
  assert(initial.storage.data.has('record')); assert.equal(initial.storage.alarmAt,null);
  observe('partial_failure','double crashes after initial record put before plan',initial,{safety:'runtime_atomicity_unverified'});
  const f=make(['record',{expires:T+5*D,value:1}]); f.storage.fault='after_put'; await expectInjected(()=>alarm(f,T+3*D),'injected:after_put');
  restart(f); await alarm(f,T+3*D); assert.equal(f.storage.alarmAt,T+3*D);
  observe('partial_failure','alarm write failure followed by reconstructed instance and replay',f,{safety:'unsafe_feedback',note:'double shows repeated write attempts; native retry count is not simulated'});
}
if (candidate==='beta' && group==='core') {
  clock.now=T; const normal=make(); await begin(normal); assert.equal(normal.storage.alarmAt,T+120000);
  for(let i=1;i<=3;i++) await alarm(normal,T+i*120000);
  assert.deepEqual(normal.storage.data.get('ledger'),{remaining:0,closed:true}); assert.equal(normal.storage.alarmAt,null);
  observe('normal','three committed countdown transactions close the ledger',normal,{safety:'finite_nominal_job'});
  const closed=make(['ledger',{remaining:0,closed:true}]); await alarm(closed,T+360000); restart(closed); await begin(closed); await alarm(closed,T+360001);
  assert.equal(closed.storage.counts.do_put_calls,0); assert.equal(closed.storage.counts.set_alarm_calls,0);
  observe('exhaustion','pending/replayed callback, restart and begin after close',closed,{safety:'bounded_control_reads',note:'three extra events still require three get calls'});
  const absent=make(); await alarm(absent,T); assert.equal(absent.storage.alarmAt,null); observe('no_progress','alarm with no ledger returns',absent,{safety:'bounded_empty_case'});
  clock.now=T; const reboot=make(); await begin(reboot); await alarm(reboot,T+120000); restart(reboot); await begin(reboot);
  await alarm(reboot,T+240000); restart(reboot); await alarm(reboot,T+360000);
  assert.equal(reboot.storage.data.get('ledger').remaining,0); assert.equal(reboot.storage.alarmAt,null);
  observe('restart','begin after reconstruction does not reset the persisted allowance',reboot,{safety:'finite_nominal_job'});
  clock.now=T; const replay=make(); await begin(replay); await alarm(replay,T+120000); await alarm(replay,T+120000); await alarm(replay,T+120000);
  await alarm(replay,T+120000); assert.equal(replay.storage.counts.do_put_calls,4); assert.equal(replay.storage.counts.set_alarm_calls,3);
  observe('replay','duplicate callbacks consume allowance then further callback only reads',replay,{safety:'finite_nominal_job',note:'early exhaustion may affect business behavior; no extra job writes'});
  clock.now=T; const access=make();
  await http(access,'GET','https://example.invalid/arbitrary',{Authorization:'Bearer invalid'});
  await http(access,'OPTIONS','https://alternate.invalid/another');
  assert.equal(access.storage.counts.do_put_calls,1); assert.equal(access.storage.counts.do_get_calls,2); assert.equal(access.storage.counts.set_alarm_calls,1);
  observe('amplification','invalid credential GET and arbitrary-host OPTIONS both reach ledger reads',access,{safety:'unrestricted_request_control_work'});
  const stop=make(['ledger',{remaining:0,closed:true}]); await alarm(stop,T+360000); restart(stop); await alarm(stop,T+360001);
  assert.equal(stop.storage.alarmAt,null); observe('stop','closed ledger survives reconstructed instance and pending callbacks',stop,{safety:'bounded_control_reads',note:'explicit mid-job disable surface is absent; actual transaction concurrency remains unsupported'});
}
if (candidate==='beta' && group==='time') {
  for(const offset of [119999,120000,120001,240000,360000,8*D]) {
    const f=make(['ledger',{remaining:3,closed:false}]); await alarm(f,T+offset);
    assert.deepEqual(f.storage.data.get('ledger'),{remaining:2,closed:false}); assert.equal(f.storage.alarmAt,T+offset+120000);
    observe('time_boundary','forced callback at T+'+offset+'ms',f,{safety:'finite_progress',note:'direct callback probe; application does not enforce minimum delay for stale deliveries'});
  }
  const backwards=make(['ledger',{remaining:3,closed:false}]); await alarm(backwards,T+120000); await alarm(backwards,T-120000); await alarm(backwards,T);
  assert.equal(backwards.storage.alarmAt,null); observe('time_boundary','backwards and repeated clock changes still exhaust allowance',backwards,{safety:'finite_progress'});
  for(const record of [{closed:false},{remaining:Infinity,closed:false}]) {
    const f=make(['ledger',record]);
    for(let i=1;i<=5;i++) await alarm(f,T+i*120000);
    assert.equal(f.storage.data.get('ledger').closed,false); assert.notEqual(f.storage.alarmAt,null);
    observe('no_progress','legacy/corrupt ledger '+(record.remaining===Infinity?'Infinity':'missing remaining'),f,{safety:'unknown_existing_state',note:'current begin creates valid remaining=3; reachability from prior deployed state is unverified; explicit five-callback harness cutoff'});
  }
}
if (candidate==='beta' && group==='fault') {
  const f=make(['ledger',{remaining:3,closed:false}]); f.storage.fault='after_put';
  await expectInjected(()=>alarm(f,T+120000),'injected:after_put'); assert.equal(f.storage.data.get('ledger').remaining,3); assert.equal(f.storage.alarmAt,null);
  restart(f); await alarm(f,T+120000); await alarm(f,T+240000); await alarm(f,T+360000);
  assert.deepEqual(f.storage.data.get('ledger'),{remaining:0,closed:true}); assert.equal(f.storage.alarmAt,null);
  observe('partial_failure','double rolls transaction back after put, then replay consumes three commits',f,{safety:'finite_under_assumed_atomicity',note:'storage transaction atomicity is implemented by this double; actual Workerd validation is not run'});
  const close=make(['ledger',{remaining:1,closed:false}]); close.storage.fault='before_deleteAlarm';
  await expectInjected(()=>alarm(close,T+120000),'injected:before_deleteAlarm'); assert.equal(close.storage.data.get('ledger').remaining,1);
  await alarm(close,T+240000); assert.equal(close.storage.data.get('ledger').closed,true); assert.equal(close.storage.alarmAt,null);
  observe('partial_failure','failure before cancellation rolls back terminal transaction in double',close,{safety:'finite_under_assumed_atomicity'});
  clock.now=T; const initial=make(); initial.storage.fault='before_setAlarm';
  await expectInjected(()=>begin(initial),'injected:before_setAlarm'); assert(initial.storage.data.has('ledger')); assert.equal(initial.storage.alarmAt,null);
  restart(initial); await begin(initial); assert.equal(initial.storage.alarmAt,null);
  observe('partial_failure','double crashes after initial ledger put before alarm schedule; begin replay returns',initial,{safety:'runtime_atomicity_and_recovery_unverified',note:'possible orphan task is a reliability verification gap, not an unbounded-cost finding'});
}
for(const o of observations) assert.equal(o.events,totalKeys.slice(0,3).reduce((n,k)=>n+o.work[k],0));
const totals=Object.fromEntries(totalKeys.map(key=>[key,observations.reduce((sum,o)=>sum+o.work[key],0)]));
assert.equal(totals.worker_invocations+totals.rpc_events+totals.alarm_events,chargedEvents);
console.log(JSON.stringify({status:'observations_completed',candidate,group,source_digest,budgets:{max_events:maxEvents,charged_events:chargedEvents,max_storage_api_calls:500,charged_storage_api_calls:chargedOperations,max_fixtures:50,charged_fixtures:chargedFixtures,max_rows_per_fixture:1,clock:'injected',network:'sandbox namespace isolated'},meter:'local double API calls; not Cloudflare billing rows',totals,observations,unsupported:['actual Workerd storage/cache billing metrics','native alarm retry/delivery limits and timings','actual eviction and storage transaction rollback/commit gates','concurrent begin/alarm interleavings','target-account controls and existing persisted state']}));
