import {validate} from './schema.mjs';
import {redact} from './core.mjs';
const cell=v=>String(v??'unknown').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
export function renderReport(input) {
  validate('report',input);const r=redact(input),t=r.deployment_identity.target;
  const usage=r.usage_assessment;
  const limits=usage.enforced_limits.map(l=>`${cell(l.dimension)} <= ${cell(l.limit)} (${cell(l.scope)}; ${cell(l.location.path)}:${l.location.start_line})`);
  const summary=`## Review summary

- **Risk paths:** ${r.findings.filter(f=>f.status==='BLOCK').length} BLOCK findings; ${r.findings.filter(f=>f.status==='REVIEW').length} REVIEW findings; ${r.coverage.unknown_edges.length} unresolved edges.
- **Work bound:** ${cell(usage.classification)}. Scope: ${cell(usage.scope)}.
- **Code-limit evidence:** ${limits.join('; ')||'No enforced limits recorded.'}
- **Local tests:** ${new Set(r.tests.filter(t=>t.status==='passed').map(t=>t.id)).size} passed. Required checks still missing: ${r.coverage.missing_tests.map(cell).join(', ')||'none'}.
- **Cloud controls:** NOT VERIFIED by this read-only tool. Local tests and code/configuration declarations do not establish operational protection.

Recorded usage assessment: ${Object.entries(usage.vector).map(([unit,value])=>`${cell(unit)}=${cell(value)}`).join('; ')}.
Assumptions: ${usage.assumptions.map(cell).join('; ')||'none recorded'}.`;
  return `# Cloudflare Cost Safety\n\n${r.overall_status} · gate ${r.predeploy_gate_status} · ${r.reviewed_at}\n\nOfficial best practices: **${r.official_best_practices_status}**. Cost safety: **${r.cost_safety_status}**.\n\nTarget: ${cell(t.application)} / ${cell(t.environment)} / ${cell(t.action)}. Input: \`${r.deployment_identity.digest}\`.\n\nThis result applies only to the recorded source, artifact, configuration, target, versions, tests and assumptions. It does not establish a monthly hard cap. Cloud writes: 0. Gate coverage: ${r.deployment_gate_coverage}.\n\n${summary}\n\n## Official context\n\n| Skill | Revision | Load | Review | References |\n|---|---|---|---|---|\n${r.official_skills.map(s=>`| ${cell(s.name)} | ${cell(s.revision)} | ${cell(s.load_status)} | ${cell(s.review_status)} | ${s.loaded_references.length} |`).join('\n')}\n\n## Cost rules\n\n| Rule | Result | Gaps |\n|---|---|---|\n${r.rules.map(x=>`| ${x.rule_id} | ${x.status} | ${cell(x.gaps.map(g=>g.reason).join('; '))} |`).join('\n')}\n\n## Findings\n\n${r.findings.length?r.findings.map(f=>`- **${f.status} ${f.rule_id||'official'}** (${f.origin}, ${f.severity}, ${f.confidence}) ${cell(f.location.path)}:${f.location.start_line} — ${f.summary}\n  Path: ${f.execution_path.map(cell).join(' → ')}. Units: ${(f.usage_assessment.units||[]).join(', ')}.\n  ${f.recommendation||''}`).join('\n'):'No supported-pattern findings. This is not a completeness claim.'}\n\n## Tests and unknowns\n\n${r.tests.map(t=>`- ${cell(t.id)}: ${cell(t.status)} (${cell(t.duration_ms)} ms); ${cell(Array.isArray(t.command)?t.command.join(' '):null)}`).join('\n')||'- No tests executed.'}\n${[...r.incomplete,...r.coverage.missing_tests.map(t=>`Required test not completed: ${t}`)].map(g=>`- ${cell(g)}`).join('\n')}\n\n## Native control coverage\n\n${r.native_controls.map(c=>`- ${c.product}/${c.control}: ${c.scope}. Current configuration: ${c.configuration_evidence}. ${c.execution_status}. [Official source](${c.official_source}).`).join('\n')}\n\n## Remaining coverage\n\nUnknown edges: ${r.coverage.unknown_edges.length}. Excluded products: ${r.coverage.uncovered_products.join(', ')}. Dollar estimate: unknown.\n\n${r.coverage.deployment_bypasses.map(p=>`- Unverified release path: ${p}`).join('\n')}\n`;
}
