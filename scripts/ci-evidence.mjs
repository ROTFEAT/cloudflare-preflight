#!/usr/bin/env node
// Runs only from the protected tools installation, never candidate code.
import fs from 'node:fs';
import path from 'node:path';
import {json,writeJSON} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';
import {validate} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/schema.mjs';
import {verifyEnvelope} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/gate.mjs';
import {controlledRelease} from './release.mjs';

try {
  const [mode,evidenceDirectory,candidateDirectory,targetPath]=process.argv.slice(2);
  const target=json(targetPath),trust=json(target.trust);
  validate('trust',trust);
  const attestation=path.join(evidenceDirectory,'attestation.json');
  const report=verifyEnvelope(json(attestation),trust);validate('report',report);
  const commit=report.deployment_identity.commit;
  if(!/^[a-f0-9]{40}$/.test(commit||''))throw new Error('CI_requires_a_verified_source_commit');
  if(mode==='commit')fs.appendFileSync(process.env.GITHUB_OUTPUT,`commit=${commit}\n`);
  else if(mode==='stage') {
    const approvals=path.join(evidenceDirectory,'approvals.json');
    const result=await controlledRelease({...target,root:path.resolve(candidateDirectory),attestation,...(fs.existsSync(approvals)?{approvals}:{} )});
    writeJSON(path.join(process.env.RUNNER_TEMP,'cost-safety-stage-result.json'),result);
    if(result.allowed)fs.appendFileSync(process.env.GITHUB_OUTPUT,`handoff=${result.handoff}\n`);
    process.stdout.write(`${result.status}: ${result.reason||'immutable handoff prepared'}\n`);process.exitCode=result.exit_code;
  } else throw new Error('CI_evidence_mode_must_be_commit_or_stage');
} catch(error){console.error(`CI evidence error: ${error.message}`);process.exitCode=3;}
