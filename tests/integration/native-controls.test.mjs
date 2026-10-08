import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {preflight} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/preflight.mjs';
import {writeJSON} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {application,opts,reviewed} from '../helpers.mjs';
import {gate,signEnvelope} from '../../.agents/skills/cloudflare-cost-safety/scripts/lib/gate.mjs';

for(const claim of [
 {control:'budget_alert',hard_monthly_cap:true},
 {control:'cpu_limit',hard_monthly_cap:true},
 {control:'queue_pause',stops_producers:true},
 {control:'deleteAlarm',surface:'account_management'},
 {control:'test_reset',production:true}
])test(`NATIVE false scope ${claim.control} is rejected`,()=>{
 const root=application();writeJSON(path.join(root,'cost-controls.json'),{claims:[claim]});
 const report=preflight(opts(root)).report;assert.ok(report.findings.some(f=>f.rule_id==='CF-SAFE-001'&&f.status==='BLOCK'));assert.equal(report.guarantees.hard_monthly_cap,false);assert.equal(report.guarantees.production_isolation_performed,false);
 const r=reviewed(),forged=structuredClone(r.report);forged.guarantees.hard_monthly_cap=true;assert.equal(gate({...r,envelope:signEnvelope(forged,r.signer)}).allowed,false);
});
