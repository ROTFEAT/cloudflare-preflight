import path from 'node:path';
import ts from 'typescript';

// A literal shell subset, not an interpreter. Expansions and unsupported
// control flow stay unknown; quoted documentation is just data.
export function parseShell(command) {
  const segments=[];let tokens=[],word='',started=false,quote=null,unknown=false,compound=false;
  const flush=()=>{if(started)tokens.push(word);word='';started=false;};
  const end=()=>{flush();if(tokens.length)segments.push(tokens);tokens=[];};
  for(let i=0;i<command.length;i++) {
    const c=command[i];
    if(c==='\\'&&quote!=="'") {if(i+1===command.length){unknown=true;break;}const next=command[++i];if(next!=='\n'){word+=next;started=true;}continue;}
    if(quote) {if(c===quote)quote=null;else {word+=c;if(quote==='"'&&(c==='$'||c==='`'))unknown=true;}continue;}
    if(c==='"'||c==="'"){quote=c;started=true;continue;}
    if(c==='#'&&!started){while(i+1<command.length&&command[i+1]!=='\n')i++;continue;}
    if(c===';'||c==='|'||c==='&'||c==='\n'){compound ||= c!=='\n';end();continue;}
    if(/\s/.test(c)){flush();continue;}
    if('$`(){}<>'.includes(c))unknown=true;
    word+=c;started=true;
  }
  end();return {segments,unknown:unknown||!!quote,compound};
}
export const shellQuote=value=>"'"+value.replaceAll("'","'\\''")+"'";
const shellCommand=tokens=>tokens.map(shellQuote).join(' ');
const executable=token=>path.basename(token||'').replace(/\.(?:cmd|exe)$/i,'').replace(/@\d.*$/,'');
const releaseWord=/^(?:deploy|publish|upload|promote|rollback|release|ship)$/i;
const localTools=new Set(['echo','printf','rg','grep','cat','sed','head','tail','ls','pwd','git','find','diff','wc','mkdir','cp','mv','rm','touch','true','false','tsc','vitest','jest','eslint','prettier','vite','astro','next','nuxi','nitro','rollup','esbuild','webpack','vercel','netlify','aws','gcloud']);
function booleanFlag(args,name) {
  let enabled=false;
  for(let i=0;i<args.length;i++) {
    if(args[i]===name)enabled=args[i+1]!=='false';
    else if(args[i].startsWith(name+'='))enabled=args[i].slice(name.length+1)==='true';
    else if(args[i]==='--no-'+name.slice(2))enabled=false;
  }
  return enabled;
}
function releaseHttp(tokens) {
  if(!tokens.some(t=>/api\.cloudflare\.com\/.*(?:workers\/(?:scripts|services|dispatch)|pages\/projects)/i.test(t)))return false;
  let method;
  for(let i=0;i<tokens.length;i++) {
    if(['-X','--request','--method'].includes(tokens[i]))method=tokens[++i];
    else if(/^-X[A-Za-z]+$/.test(tokens[i]))method=tokens[i].slice(2);
    else if(/^--(?:request|method)=/.test(tokens[i]))method=tokens[i].split('=')[1];
  }
  if(method)return ['POST','PUT','PATCH','DELETE'].includes(method.toUpperCase());
  return tokens.some(t=>/^-[dFT]/.test(t)||/^--(?:data(?:-[\w]+)?|form(?:-string)?|upload-file|post-data|post-file)(?:=|$)/.test(t));
}
function stripLaunchers(input) {
  let tokens=[...input];
  while(/^[A-Za-z_][A-Za-z_0-9]*=/.test(tokens[0]||''))tokens.shift();
  if(executable(tokens[0])==='env') {tokens.shift();while(tokens.length&&(tokens[0].startsWith('-')||/^[\w]+=/.test(tokens[0]))){if(['-u','--unset','-C','--chdir'].includes(tokens[0]))tokens.shift();tokens.shift();}}
  while(['command','exec','nohup','sudo'].includes(executable(tokens[0]))) {tokens.shift();while(tokens[0]?.startsWith('-')){if(['-u','-g'].includes(tokens[0]))tokens.shift();tokens.shift();}}
  const first=executable(tokens[0]);
  if(['npx','bunx'].includes(first)||['pnpm','yarn','bun'].includes(first)&&['exec','dlx','x'].includes(tokens[1])||first==='npm'&&tokens.includes('exec')) {
    tokens=tokens.slice(first==='npm'?tokens.indexOf('exec')+1:['npx','bunx'].includes(first)?1:2);
    while(tokens[0]?.startsWith('-')){if(['-p','--package','--cache','--registry'].includes(tokens[0]))tokens.shift();tokens.shift();}
  }
  return tokens;
}
export function resolveCommand(command,scripts={},texts=new Map(),seen=new Set(),context={}) {
  const budget=context.budget||{remaining:100};
  if(--budget.remaining<0||seen.size>20||seen.has(command)||command.length>65536)return {effects:[],unknown:true,expanded:[]};
  const next=new Set([...seen,command]),parsed=parseShell(command);
  const result={effects:[],unknown:parsed.unknown,expanded:[command],cloudflare:false};
  let current={...context,budget},currentScripts=scripts,currentTexts=texts;
  const merge=nested=>{result.effects.push(...nested.effects);result.expanded.push(...nested.expanded);result.unknown ||= nested.unknown;result.cloudflare ||= nested.cloudflare;};
  const expand=(text,s=currentScripts,t=currentTexts,c=current)=>merge(resolveCommand(text,s,t,next,c));
  for(const original of parsed.segments) {
    let tokens=stripLaunchers(original),bin=executable(tokens[0]);
    if(!tokens.length)continue;
    if(bin==='cd'&&tokens.length===2&&current.load) {current={...current,...current.load(path.resolve(current.cwd,tokens[1])),budget};currentScripts=current.scripts;currentTexts=current.texts;continue;}
    if(['bash','sh','zsh','dash'].includes(bin)) {
      const index=tokens.findIndex(t=>/^-.*c/.test(t));
      if(index>=0&&tokens[index+1])expand(tokens[index+1]);
      else if(tokens[1]&&currentTexts.has(tokens[1]))expand(currentTexts.get(tokens[1]));
      else result.unknown=true;
      continue;
    }
    if(['npm','pnpm','yarn','bun'].includes(bin)) {
      const args=tokens.slice(1);let selected=current;
      if(args.some(arg=>['--workspace','-w','--workspaces','--filter','-F','--recursive','-r'].includes(arg)||/^--(?:workspace|filter)=/.test(arg)))result.unknown=true;
      for(let i=0;i<args.length;i++)if(['--prefix','--dir','-C','--cwd'].includes(args[i])&&current.load&&args[i+1])selected={...current,...current.load(path.resolve(current.cwd,args[++i])),budget};
      const names=args.filter((arg,i)=>!arg.startsWith('-')&&!['--prefix','--dir','-C','--cwd','--filter','-F','--workspace','-w'].includes(args[i-1]));
      const name=names[0]==='run'||names[0]==='run-script'?names[1]:names[0];
      if(selected.root&&selected.root!==selected.cwd&&current.load)selected={...selected,...current.load(selected.root),budget};
      const selectedScripts=selected.scripts||currentScripts,selectedTexts=selected.texts||currentTexts;
      if(name&&Object.hasOwn(selectedScripts,name)) {
        for(const stage of [`pre${name}`,name,`post${name}`])if(Object.hasOwn(selectedScripts,stage)) {
          if(typeof selectedScripts[stage]!=='string'){result.unknown=true;continue;}
          expand(selectedScripts[stage],selectedScripts,selectedTexts,selected);
        }
      } else if(['wrangler','cf','opennextjs-cloudflare'].includes(name))expand(shellCommand([name,...args.slice(args.indexOf(name)+1)]));
      else if(['build','test','format','lint','typecheck'].includes(name)&&!current.load) { /* intent caller without filesystem context */ }
      else result.unknown=true;
      continue;
    }
    if(bin==='node'&&/[/\\]wrangler[/\\].*\.(?:js|mjs|cjs)$/.test(tokens[1]||'')){tokens=['wrangler',...tokens.slice(2)];bin='wrangler';}
    if(bin==='wrangler'||bin==='cf') {
      result.cloudflare=true;
      const args=tokens.slice(1),words=[];
      for(let i=0;i<args.length;i++) {
        if(['--config','-c','--env','-e','--cwd','--profile','--env-file'].includes(args[i]))i++;
        else if(!args[i].startsWith('-'))words.push(args[i]);
      }
      if(booleanFlag(args,'--help')||args.includes('-h')||args.includes('--version'))continue;
      if(args.includes('--remote'))result.effects.push({type:'remote_data',command:'redacted_command_metadata'});
      const drySupported=bin==='wrangler'&&(words[0]==='deploy'||words[0]==='publish'||['versions','triggers'].includes(words[0])&&['upload','deploy'].includes(words[1]));
      const localDev=words[0]==='dev'||bin==='wrangler'&&words[0]==='pages'&&words[1]==='dev';
      if(current.configCheck&&(localDev||drySupported&&booleanFlag(args,'--dry-run'))) {
        const config=current.configCheck(args,current.cwd);result.unknown ||= config.unknown;
        if(config.buildCommand)expand(config.buildCommand);
        if(config.remoteBinding&&localDev)result.effects.push({type:'possible_remote_preview'});
      }
      if(drySupported&&booleanFlag(args,'--dry-run'))continue;
      if(localDev){if(booleanFlag(args,'--remote'))result.effects.push({type:'possible_remote_preview'});continue;}
      const secret=words.includes('secret')||words.includes('secrets');
      const preview=words[0]==='preview'&&!['list','get','view','delete','base-config','secret'].includes(words[1]);
      const createVersion=bin==='cf'&&words.includes('versions')&&words.includes('create');
      if(words.some(w=>releaseWord.test(w))||preview||createVersion||secret&&words.some(w=>['put','delete','bulk'].includes(w)))result.effects.push({type:'cloudflare_release',action:words.slice(0,3).join(' ')});
      else if(words.length&&!words.some(w=>['list','get','view','read','status','tail'].includes(w))&&!['types','whoami','login','logout','init','setup','delete','telemetry','d1','kv','r2','queues','vectorize','hyperdrive'].includes(words[0]))result.unknown=true;
      continue;
    }
    if(current.isReviewCli?.(tokens,current.cwd)||bin==='node'&&tokens.length===2&&['--version','-v','--help'].includes(tokens[1]))continue;
    const script=bin==='node'&&!tokens[1]?.startsWith('-')?tokens[1]:null;
    if(script&&currentTexts.has(script)) {
      const source=currentTexts.get(script),ast=ts.createSourceFile(script,source,ts.ScriptTarget.Latest,true);let extracted=false;
      function walk(node) {
        if(ts.isImportDeclaration(node)&&(!ts.isStringLiteral(node.moduleSpecifier)||!['node:child_process','child_process'].includes(node.moduleSpecifier.text)))result.unknown=true;
        if(ts.isCallExpression(node)&&/^(?:exec|execSync|execFile|execFileSync|spawn|spawnSync)$/.test(node.expression.getText(ast).split('.').at(-1))) {
          const first=node.arguments[0],args=node.arguments[1];
          if(node.arguments[2]||args&&ts.isObjectLiteralExpression(args))result.unknown=true;
          if(first&&ts.isStringLiteral(first)) {
            if(args&&ts.isArrayLiteralExpression(args)) {
              if(args.elements.every(ts.isStringLiteral))expand(shellCommand([first.text,...args.elements.map(n=>n.text)]));
              else result.unknown=true;
            } else if(/^(?:exec|execSync)$/.test(node.expression.getText(ast).split('.').at(-1)))expand(first.text);
            else if(!args)expand(shellCommand([first.text]));
            else result.unknown=true;
            extracted=true;
          } else result.unknown=true;
        } else if(ts.isCallExpression(node)&&!(node.expression.getText(ast)==='require'&&ts.isStringLiteral(node.arguments[0])&&['node:child_process','child_process'].includes(node.arguments[0].text)))result.unknown=true;
        ts.forEachChild(node,walk);
      }
      walk(ast);if(!extracted)result.unknown=true;
      continue;
    }
    if(/^(?:opennextjs-cloudflare|opennext|next-on-pages|nuxthub|cloudflare)$/.test(bin)&&tokens.some(w=>releaseWord.test(w)||w==='preview')) {result.effects.push({type:'possible_cloudflare_release'});result.unknown=true;}
    else if(['astro','vite','nuxi','nitro','sst','alchemy','terraform','pulumi'].includes(bin)&&tokens.some(w=>releaseWord.test(w)||['apply','up'].includes(w))&&current.cloudflare!==false) {result.effects.push({type:'possible_cloudflare_release'});result.unknown=true;}
    else if(['curl','wget'].includes(bin)&&releaseHttp(tokens))result.effects.push({type:'possible_cloudflare_release'});
    else if(['curl','wget'].includes(bin)) { /* read-only HTTP calls do not publish */ }
    else if(!localTools.has(bin))result.unknown=true;
  }
  return result;
}
export function classifyIntent({request='',command='',scripts={},texts=new Map(),explicit=false,context='execute'}={}) {
  if(explicit||request.includes('$cloudflare-cost-safety'))return {trigger:true,activation:'explicit_early_preflight',status:'resolved'};
  if(context==='explain'||/^(?:解释|说明|阅读|查看|read\b|explain\b|what does\b)/i.test(request))return {trigger:false,activation:'explanation',status:'resolved'};
  if(command) {
    const resolved=resolveCommand(command,scripts,texts),cf=resolved.effects.some(e=>e.type!=='remote_data');
    return {trigger:cf||resolved.unknown,activation:cf?'before_cloudflare_deployment':resolved.unknown?'target_confirmation':'local_or_non_cf',status:resolved.unknown?'unknown':'resolved',...resolved};
  }
  const cf=/(?:cloudflare|\bCF\b|worker)/i.test(request),release=/(?:部署|上线|发布|晋升|回滚|预览|deploy|publish|promot|rollback|preview)/i.test(request);
  return {trigger:cf&&release,activation:cf&&release?'before_cloudflare_deployment':'ordinary_work',status:'resolved'};
}
