import ts from 'typescript';

function splitShell(command) {
  const segments = []; let current = '', quote = null;
  for (let i=0;i<command.length;i++) {
    const c=command[i];
    if (quote) { current+=c; if(c===quote && command[i-1]!=='\\') quote=null; continue; }
    if(c==='"'||c==="'") {quote=c;current+=c;continue;}
    if(c===';'||c==='|'||c==='&'||c==='\n') { if(current.trim())segments.push(current.trim());current='';continue; }
    current+=c;
  }
  if(current.trim())segments.push(current.trim());
  return {segments,unknown:!!quote||/[$`]\(|`|\$\{|\beval\b|\bbash\s+-c\b|\bsh\s+-c\b/.test(command)};
}
export function resolveCommand(command, scripts = {}, texts = new Map(), seen = new Set()) {
  if(seen.size>20||seen.has(command)) return { effects:[],unknown:true,expanded:[] };
  const next = new Set([...seen,command]);
  const {segments,unknown}=splitShell(command);
  const result={effects:[],unknown,expanded:[command]};
  for(const segment of segments) {
    const tokens=segment.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g)?.map(s=>s.replace(/^['"]|['"]$/g,''))||[];
    if(tokens.some(t=>t==='--remote')) result.effects.push({type:'remote_data',command:'redacted_command_metadata'});
    const wrapper=segment.match(/^(?:npm|pnpm|yarn)\s+(?:run\s+)?([\w:-]+)/);
    if(wrapper&&scripts[wrapper[1]]) {
      // npm lifecycle scripts may deploy before or after a supposedly local command.
      for(const name of [`pre${wrapper[1]}`,wrapper[1],`post${wrapper[1]}`]) if(scripts[name]) {
        const nested=resolveCommand(scripts[name],scripts,texts,next);
        result.effects.push(...nested.effects);result.expanded.push(...nested.expanded);result.unknown ||= nested.unknown;
      }
      continue;
    }
    const cli=tokens.findIndex(t=>/(?:^|\/)wrangler(?:\.cmd)?$/.test(t));
    if(cli>=0) {
      const args=tokens.slice(cli+1);
      if(args.includes('--dry-run')) continue;
      if(args[0]==='dev') { if(args.includes('--remote'))result.effects.push({type:'possible_remote_preview'}); continue; }
      if(args.some(a=>['deploy','publish','rollback','upload'].includes(a))||args[0]==='secret'&&['put','delete','bulk'].includes(args[1])) result.effects.push({type:'cloudflare_release',action:args.slice(0,3).join(' ')});
      continue;
    }
    const script=tokens[0]==='node'?tokens[1]:null;
    if(script&&texts.has(script)) {
      const ast=ts.createSourceFile(script,texts.get(script),ts.ScriptTarget.Latest,true);
      let extracted=false;
      function walk(node) {
        if(ts.isCallExpression(node)&&/^(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)$/.test(node.expression.getText(ast).split('.').at(-1))) {
          const first=node.arguments[0];
          if(first&&ts.isStringLiteral(first)) {
            const args=node.arguments[1];
            const suffix=args&&ts.isArrayLiteralExpression(args)?args.elements.filter(ts.isStringLiteral).map(n=>n.text).join(' '):'';
            const nested=resolveCommand(`${first.text} ${suffix}`,scripts,texts,next);
            result.effects.push(...nested.effects);result.expanded.push(...nested.expanded);result.unknown ||= nested.unknown;extracted=true;
          } else result.unknown=true;
        }
        ts.forEachChild(node,walk);
      } walk(ast);
      if(!extracted)result.unknown=true;
      continue;
    }
    if(/\b(?:cf|opennext|astro|vite|next-on-pages|cloudflare)\b/.test(segment)&&/deploy|publish|preview/.test(segment)) {result.effects.push({type:'possible_cloudflare_release'});result.unknown=true;}
    else if(!/^(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:build|test|format|lint|typecheck)\b/.test(segment)&&! /^(?:echo|printf|tsc|vitest|eslint|prettier|true|vercel)\b/.test(segment)) result.unknown=true;
  }
  return result;
}
export function classifyIntent({request='',command='',scripts={},texts=new Map(),explicit=false,context='execute'}={}) {
  if(explicit||request.includes('$cloudflare-cost-safety')) return {trigger:true,activation:'explicit_early_preflight',status:'resolved'};
  if(context==='explain'||/^(?:解释|说明|阅读|查看|read\b|explain\b|what does\b)/i.test(request)) return {trigger:false,activation:'explanation',status:'resolved'};
  if(command) {
    const resolved=resolveCommand(command,scripts,texts);
    const cf=resolved.effects.some(e=>e.type!=='remote_data');
    return {trigger:cf||resolved.unknown,activation:cf?'before_cloudflare_deployment':resolved.unknown?'target_confirmation':'local_or_non_cf',status:resolved.unknown?'unknown':'resolved',...resolved};
  }
  const cf=/(?:cloudflare|\bCF\b|worker)/i.test(request);
  const release=/(?:部署|上线|发布|晋升|回滚|预览|deploy|publish|promot|rollback|preview)/i.test(request);
  return {trigger:cf&&release,activation:cf&&release?'before_cloudflare_deployment':'ordinary_work',status:'resolved'};
}
