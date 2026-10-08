import ts from 'typescript';
import path from 'node:path';

const functionLike = n => ts.isFunctionDeclaration(n)||ts.isMethodDeclaration(n)||ts.isConstructorDeclaration(n)||ts.isFunctionExpression(n)||ts.isArrowFunction(n);
const localFile=(base,spec,texts)=>[spec,`${spec}.ts`,`${spec}.js`,`${spec}.mts`,`${spec}.mjs`,`${spec}/index.ts`,`${spec}/index.js`].map(x=>path.posix.normalize(path.posix.join(path.posix.dirname(base),x))).find(x=>texts.has(x));
const nameOf = n => n?.name?.text || n?.name?.getText() || (ts.isConstructorDeclaration(n)?'constructor':null);
export function analyzeAST(texts,config) {
  const functions=[],calls=[],imports=[],gaps=[],sources=new Map(),byNode=new Map(),moduleExports=new Map(),classes=[];
  const bindingNames=new Map(config.bindings.filter(b=>b.name).map(b=>[b.name,b.kind]));
  const loc=(sf,n)=>({path:sf.fileName,start_line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,end_line:sf.getLineAndCharacterOfPosition(n.getEnd()).line+1});
  for(const [file,text] of texts) {
    if(!/\.[cm]?[jt]sx?$/.test(file)||file.endsWith('.d.ts'))continue;
    const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);sources.set(file,sf);
    if(sf.parseDiagnostics.length)gaps.push({path:file,reason:'typescript_parse_error'});
    const exported=new Map();moduleExports.set(file,exported);
    const module={id:`${file}#module`,name:'module',file,kind:'module',entry:false,location:{path:file,start_line:1,end_line:1},node:sf,facts:{calls:[],ifs:[],loops:[],assignments:[],returns:[]},aliases:new Map()};
    functions.push(module);byNode.set(sf,module);
    function collect(node,owner=module,className=null) {
      if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)) {
        const spec=node.moduleSpecifier.text;
        imports.push({file,local:null,exported:null,target:spec.startsWith('.')?localFile(file,spec,texts):null,spec,location:loc(sf,node)});
        const names=node.importClause?.namedBindings;
        if(names&&ts.isNamedImports(names)) for(const n of names.elements)imports.push({file,local:n.name.text,exported:n.propertyName?.text||n.name.text,target:spec.startsWith('.')?localFile(file,spec,texts):null,spec,location:loc(sf,node)});
        if(node.importClause?.name)imports.push({file,local:node.importClause.name.text,exported:'default',target:spec.startsWith('.')?localFile(file,spec,texts):null,spec,location:loc(sf,node)});
        if(spec.startsWith('.')&&!localFile(file,spec,texts))gaps.push({path:file,reason:'local_import_unresolved',location:loc(sf,node)});
      }
      if(ts.isClassDeclaration(node)) {
        className=node.name?.text||'anonymous';
        classes.push({name:className,file,location:loc(sf,node),base:node.heritageClauses?.map(h=>h.getText(sf)).join(' ')||'',fields:node.members.filter(ts.isPropertyDeclaration).map(m=>({name:m.name.getText(sf),initial:m.initializer?.getText(sf)||null,location:loc(sf,m)}))});
      }
      if(functionLike(node)) {
        const name=nameOf(node)||(ts.isVariableDeclaration(node.parent)?node.parent.name.getText(sf):`callback@${node.pos}`);
        const directModule=owner.kind==='module';
        const isMethod=ts.isMethodDeclaration(node)||ts.isConstructorDeclaration(node);
        const record={id:`${file}#${className?`${className}.`:''}${name}@${node.pos}`,name,file,className:isMethod?className:null,kind:isMethod?'method':'function',entry:false,entry_type:['fetch','scheduled','queue','alarm','constructor','onStart'].includes(name)?name:className?'rpc':null,location:loc(sf,node),node,facts:{calls:[],ifs:[],loops:[],assignments:[],returns:[]},aliases:new Map(module.aliases)};
        if(node.modifiers?.some(m=>m.kind===ts.SyntaxKind.PrivateKeyword))record.entry=false;
        functions.push(record);byNode.set(node,record);
        if(directModule)exported.set(name,record.id);
        if(!isMethod&&(!directModule||ts.isCallExpression(node.parent))) calls.push({from:owner.id,to:record.id,kind:'callback',location:record.location});
        owner=record;
      }
      if(ts.isVariableDeclaration(node)&&node.initializer)owner.aliases.set(node.name.getText(sf),node.initializer);
      if(ts.isIfStatement(node))owner.facts.ifs.push(node);
      if(ts.isForStatement(node)||ts.isForOfStatement(node)||ts.isWhileStatement(node)||ts.isDoStatement(node))owner.facts.loops.push(node);
      if(ts.isBinaryExpression(node)&&[ts.SyntaxKind.EqualsToken,ts.SyntaxKind.PlusEqualsToken,ts.SyntaxKind.MinusEqualsToken].includes(node.operatorToken.kind))owner.facts.assignments.push(node);
      if(ts.isReturnStatement(node))owner.facts.returns.push(node);
      if(ts.isCallExpression(node)) {
        let dead=false;
        for(let p=node.parent;p&&p!==owner.node;p=p.parent)if(ts.isIfStatement(p)&&p.expression.kind===ts.SyntaxKind.FalseKeyword&&p.thenStatement.pos<=node.pos&&node.end<=p.thenStatement.end)dead=true;
        if(!dead)owner.facts.calls.push(node);
      }
      ts.forEachChild(node,child=>collect(child,owner,className));
    }
    ts.forEachChild(sf,collect);
  }
  // Only actual default-exported Worker handlers are entries. A dead local
  // helper named fetch/queue/scheduled is not automatically a public handler.
  for(const [file,sf] of sources) {
    const module=functions.find(f=>f.file===file&&f.kind==='module');
    function resolve(node,depth=0) {
      if(!node||depth>8)return null;
      if(ts.isAsExpression(node)||ts.isSatisfiesExpression(node)||ts.isParenthesizedExpression(node))return resolve(node.expression,depth+1);
      if(ts.isIdentifier(node)&&module.aliases.has(node.text))return resolve(module.aliases.get(node.text),depth+1);
      return node;
    }
    for(const statement of sf.statements)if(ts.isExportAssignment(statement)) {
      const object=resolve(statement.expression);
      if(object&&ts.isObjectLiteralExpression(object))for(const property of object.properties) {
        const name=property.name?.getText(sf)?.replace(/^["']|["']$/g,'');
        if(!['fetch','scheduled','queue'].includes(name))continue;
        const target=ts.isMethodDeclaration(property)?byNode.get(property):ts.isPropertyAssignment(property)?byNode.get(resolve(property.initializer)):null;
        const id=target?.id||(ts.isShorthandPropertyAssignment(property)||ts.isPropertyAssignment(property)&&ts.isIdentifier(property.initializer)?moduleExports.get(file).get(ts.isPropertyAssignment(property)?property.initializer.text:name):null);
        const handler=functions.find(f=>f.id===id);if(handler){handler.entry=true;handler.entry_type=name;}
      }
    }
    for(const cls of sf.statements.filter(ts.isClassDeclaration))if(cls.modifiers?.some(m=>m.kind===ts.SyntaxKind.DefaultKeyword)&&cls.heritageClauses?.some(h=>/\bWorkerEntrypoint\b/.test(h.getText(sf))))for(const fn of functions.filter(f=>f.file===file&&f.className===cls.name?.text&&['fetch','scheduled','queue'].includes(f.name)))fn.entry=true;
  }
  function bind(expr,owner,depth=0) {
    if(!expr||depth>8)return null;
    if(ts.isIdentifier(expr)&&owner.aliases.has(expr.text))return bind(owner.aliases.get(expr.text),owner,depth+1);
    if(ts.isPropertyAccessExpression(expr)) {
      const text=expr.getText(sources.get(owner.file));
      const receiver=expr.expression.getText(sources.get(owner.file));
      if(bindingNames.has(expr.name.text)&&['env','this.env'].includes(receiver)&&!(receiver==='env'&&owner.aliases.has('env')))return {name:expr.name.text,kind:bindingNames.get(expr.name.text)};
      if(expr.name.text==='storage'||text.includes('.storage.sql'))return {name:'DO.storage',kind:'do_storage'};
      return bind(expr.expression,owner,depth+1);
    }
    if(ts.isCallExpression(expr))return bind(expr.expression,owner,depth+1);
    return null;
  }
  const operations=[];
  for(const owner of functions) {
    const sf=sources.get(owner.file);
    for(const node of owner.facts.calls) {
      const expr=node.expression;
      const method=ts.isPropertyAccessExpression(expr)?expr.name.text:ts.isIdentifier(expr)?expr.text:'dynamic';
      let target=null;
      if(ts.isIdentifier(expr)) {
        const imported=imports.find(i=>i.file===owner.file&&i.local===expr.text);
        if(imported?.target)target=moduleExports.get(imported.target)?.get(imported.exported);
        else target=moduleExports.get(owner.file)?.get(expr.text);
      } else if(ts.isPropertyAccessExpression(expr)&&expr.expression.kind===ts.SyntaxKind.ThisKeyword)target=functions.find(f=>f.file===owner.file&&f.className===owner.className&&f.name===method)?.id;
      if(target)calls.push({from:owner.id,to:target,kind:'local_call',location:loc(sf,node)});
      const binding=bind(expr,owner);
      const isStorage=/^(?:setAlarm|getAlarm|deleteAlarm)$/.test(method)||binding;
      const isFetch=method==='fetch';
      const operation={id:`op:${owner.file}:${node.pos}:${node.end}`,owner:owner.id,method,binding,location:loc(sf,node),node,args:[...node.arguments],loops:owner.facts.loops.filter(l=>l.pos<node.pos&&node.end<l.end)};
      if(isStorage||isFetch||['newUniqueId','setInterval','abortAllDurableObjects'].includes(method))operations.push(operation);
      if(method==='setAlarm') {
        const alarm=functions.find(f=>f.file===owner.file&&f.className===owner.className&&f.name==='alarm');
        if(alarm)calls.push({from:owner.id,to:alarm.id,kind:'schedule',location:loc(sf,node)});
      }
      if(isFetch&&!target&&!binding) {
        const url=node.arguments[0];
        gaps.push({path:owner.file,reason:'external_or_dynamic_endpoint',location:loc(sf,node),owner:owner.id});
      }
    }
  }
  const publicClientFiles=new Set();
  const assetsDirectory=config.effective.assets?.directory?.replace(/^\.\//,'').replace(/\/$/,'');
  if(assetsDirectory)for(const [file,html] of texts)if(file.startsWith(`${assetsDirectory}/`)&&file.endsWith('.html')&&!/<!--|<%|\{\{/.test(html)) {
    // Narrow literal HTML entry adapter; dynamic templates stay out of proof.
    for(const match of html.matchAll(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
      const ref=match[1];if(/^(?:[a-z]+:|\/\/)/i.test(ref))continue;
      const client=ref.startsWith('/')?`${assetsDirectory}${ref}`:path.posix.normalize(path.posix.join(path.posix.dirname(file),ref));
      if(texts.has(client)&&/\.[cm]?js$/.test(client))publicClientFiles.add(client);
    }
  }
  const activeFiles=new Set([...(config.effective.main?[path.posix.normalize(config.effective.main)]:[]),...publicClientFiles]);
  let expand=true;
  while(expand){expand=false;for(const i of imports)if(activeFiles.has(i.file)&&i.target&&!activeFiles.has(i.target)){activeFiles.add(i.target);expand=true;}}
  for(const f of functions)if(!activeFiles.has(f.file))f.entry=false;
  // A namespace declaration and constructing a stub do not activate an object.
  // Link only a real stub RPC/fetch to its local class and constructor. Existing
  // remote alarms and external SDK dispatch remain explicit unknowns.
  const doBindings=config.bindings.filter(b=>b.kind==='durable_object');
  function isStub(expr,owner,depth=0) {
    if(!expr||depth>8)return false;
    if(ts.isIdentifier(expr)&&owner.aliases.has(expr.text))return isStub(owner.aliases.get(expr.text),owner,depth+1);
    return ts.isCallExpression(expr)&&ts.isPropertyAccessExpression(expr.expression)&&['get','getByName'].includes(expr.expression.name.text)&&bind(expr.expression.expression,owner)?.kind==='durable_object';
  }
  const activations=[];
  for(const op of operations.filter(o=>o.binding?.kind==='durable_object')) {
    const owner=functions.find(f=>f.id===op.owner),expr=op.node.expression;
    if(!ts.isPropertyAccessExpression(expr)||!isStub(expr.expression,owner))continue;
    const binding=doBindings.find(b=>b.name===op.binding.name);
    const cls=classes.find(c=>activeFiles.has(c.file)&&c.name===binding?.config?.class_name);
    if(!cls||!/\bDurableObject\b/.test(cls.base)||['alarm','constructor','onStart'].includes(op.method)) {
      gaps.push({path:op.location.path,location:op.location,owner:op.owner,reason:'durable_object_dispatch_unresolved'});continue;
    }
    const method=functions.find(f=>f.file===cls.file&&f.className===cls.name&&f.name===op.method);
    if(!method){gaps.push({path:op.location.path,location:op.location,owner:op.owner,reason:'durable_object_rpc_unresolved'});continue;}
    activations.push({owner:op.owner,className:cls.name,file:cls.file,location:op.location});
    calls.push({from:owner.id,to:method.id,kind:'durable_object_activation',location:op.location});
    const constructor=functions.find(f=>f.file===cls.file&&f.className===cls.name&&f.name==='constructor');
    if(constructor)calls.push({from:owner.id,to:constructor.id,kind:'durable_object_constructor',location:op.location});
  }
  for(const i of imports)if(activeFiles.has(i.file)&&i.target)calls.push({from:`${i.file}#module`,to:`${i.target}#module`,kind:'module_initialization',location:i.location});
  const entries=functions.filter(f=>f.entry);
  const reachable=new Set(entries.map(f=>f.id));
  // Imported module initialization runs when the candidate entry is loaded.
  if(config.effective.main)reachable.add(`${path.posix.normalize(config.effective.main)}#module`);
  for(const client of publicClientFiles)reachable.add(`${client}#module`);
  let change=true;
  while(change) {change=false;for(const e of calls)if(reachable.has(e.from)&&!reachable.has(e.to)){reachable.add(e.to);change=true;}}
  const descendants=id=>{
    const found=new Set([id]);let again=true;
    while(again){again=false;for(const edge of calls)if(found.has(edge.from)&&!found.has(edge.to)){found.add(edge.to);again=true;}}
    return found;
  };
  function serializedGraph() {
    const nodes=functions.filter(f=>reachable.has(f.id)).map(f=>({id:f.id,kind:f.entry?'entry':'logical_task',name:f.name,entry_type:f.entry_type||null,status:'declared',location:f.location}));
    for(const b of config.bindings)nodes.push({id:`resource:${b.name}`,kind:'resource',product:b.kind,status:b.status,location:b.evidence});
    for(const op of operations.filter(o=>reachable.has(o.owner)&&o.binding))if(!nodes.some(n=>n.id===`resource:${op.binding.name}`))nodes.push({id:`resource:${op.binding.name}`,kind:'resource',product:op.binding.kind,status:'declared',location:op.location});
    const edges=calls.filter(c=>reachable.has(c.from));
    for(const op of operations.filter(o=>reachable.has(o.owner))) {
      nodes.push({id:op.id,kind:'billable_operation',operation:op.method,resource:op.binding?.name||null,status:op.binding?'declared':'unknown',location:op.location});
      edges.push({from:op.owner,to:op.id,kind:op.method,location:op.location});
      if(op.binding)edges.push({from:op.id,to:`resource:${op.binding.name}`,kind:'resource_access',location:op.location});
    }
    for(const gap of gaps.filter(g=>g.owner&&reachable.has(g.owner)))edges.push({from:gap.owner,to:'unknown',kind:'unknown',location:gap.location});
    return {nodes,edges};
  }
  const activatedClasses=activations.filter(a=>reachable.has(a.owner));
  return {functions,operations,calls,imports,classes,sources,gaps,entries,reachable,descendants,activatedClasses,publicClientFiles,graph:serializedGraph(),loc};
}

export function guardsReturn(fn, pattern) {
  return fn.facts.ifs.some(n=>pattern.test(n.expression.getText())&&function(){let result=false;function walk(c){if(ts.isReturnStatement(c))result=true;ts.forEachChild(c,walk);}walk(n.thenStatement);return result;}());
}
export function literal(n) {return n&&(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null;}
export function boundedLoop(node) {
  return ts.isForStatement(node)&&node.condition&&ts.isBinaryExpression(node.condition)&&[ts.SyntaxKind.LessThanToken,ts.SyntaxKind.LessThanEqualsToken].includes(node.condition.operatorToken.kind)&&ts.isNumericLiteral(node.condition.right)&&Number(node.condition.right.text)<=10000&&!!node.incrementor;
}
