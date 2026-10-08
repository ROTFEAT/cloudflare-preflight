import SQL from 'node-sql-parser';
import ts from 'typescript';
import { literal } from './ast.mjs';

const parser=new SQL.Parser();
export function parseSQL(text) {
  try {const result=parser.astify(text,{database:'sqlite'});return {statements:Array.isArray(result)?result:[result],status:'parsed'};}
  catch {return {statements:[],status:'unsupported_sql_syntax'};}
}
export function collectSQL(ast,texts,config) {
  const queries=[],migrations=[],indexes=[],tables=new Set(),gaps=[];
  for(const [file,text] of texts)if(file.endsWith('.sql')) {
    const parsed=parseSQL(text);migrations.push({path:file,status:parsed.status});
    if(parsed.status!=='parsed')gaps.push({path:file,reason:parsed.status});
    for(const statement of parsed.statements) {
      if(statement.type==='create'&&statement.keyword==='index')indexes.push({table:statement.table.table,columns:statement.index_columns.map(x=>x.column),path:file});
      if(statement.type==='create'&&statement.keyword==='table') {
        const name=statement.table[0].table;tables.add(name);
        for(const column of statement.create_definitions||[])if(column.primary_key||column.unique)indexes.push({table:name,columns:[column.column?.column],path:file});
        for(const constraint of statement.create_definitions||[])if(constraint.definition?.some?.(d=>d.type==='column_ref'))indexes.push({table:name,columns:constraint.definition.map(d=>d.column),path:file});
      }
    }
  }
  for(const op of ast.operations) {
    if(!ast.reachable.has(op.owner)||!['prepare','exec'].includes(op.method))continue;
    if(op.method==='exec'&&!['d1','do_storage'].includes(op.binding?.kind))continue;
    // D1 prepare alone performs no query. Follow the AST chain or a prepared statement variable.
    let executed=op.method==='exec';
    if(op.method==='prepare') {
      let p=op.node.parent;
      while(p&& !ts.isExpressionStatement(p)&& !ts.isVariableDeclaration(p)&&!ts.isReturnStatement(p)) {
        if(ts.isCallExpression(p)&&ts.isPropertyAccessExpression(p.expression)&&['all','first','raw','run'].includes(p.expression.name.text))executed=true;
        p=p.parent;
      }
      if(p&&ts.isVariableDeclaration(p)) {
        const owner=ast.functions.find(f=>f.id===op.owner);
        if(owner.facts.calls.some(c=>ts.isPropertyAccessExpression(c.expression)&&['all','first','raw','run'].includes(c.expression.name.text)&&c.expression.expression.getText().startsWith(p.name.getText())))executed=true;
      }
    }
    if(!executed)continue;
    const text=literal(op.args[0]);
    const parsed=text===null?{status:'dynamic_sql',statements:[]}:parseSQL(text);
    queries.push({...op,text,status:parsed.status,statements:parsed.statements});
    if(parsed.status!=='parsed')gaps.push({location:op.location,reason:parsed.status,owner:op.owner});
  }
  function schemaFor(query) {
    const owner=ast.functions.find(f=>f.id===query.owner);
    if(query.binding?.kind==='do_storage') {
      const initializers=queries.filter(q=>{
        const f=ast.functions.find(fn=>fn.id===q.owner);
        return q.binding?.kind==='do_storage'&&f?.file===owner?.file&&f?.className===owner?.className&&f?.name==='constructor';
      });
      const knownTables=new Set(),knownIndexes=[],ddl=[];
      for(const q of initializers)for(const s of q.statements)if(s.type==='create') {
        if(s.keyword==='table') {
          const name=s.table[0].table;knownTables.add(name);ddl.push(q.text);
          for(const c of s.create_definitions||[])if(c.primary_key||c.unique)knownIndexes.push({table:name,columns:[c.column?.column]});
        }
        if(s.keyword==='index'){knownIndexes.push({table:s.table.table,columns:s.index_columns.map(c=>c.column)});ddl.push(q.text);}
      }
      return {key:`do:${owner?.file}:${owner?.className}`,tables:knownTables,indexes:knownIndexes,ddl:[...new Set(ddl)].join('\n'),known:knownTables.size>0};
    }
    const binding=config?.bindings.find(b=>b.kind==='d1'&&b.name===query.binding?.name);
    const directory=binding?.config?.migrations_dir||'migrations';
    const selected=[...texts].filter(([f])=>f.startsWith(`${directory}/`)&&f.endsWith('.sql'));
    // Never apply a DO schema or another database's migration directory to D1.
    const knownTables=new Set(),knownIndexes=[];
    for(const [file,text] of selected)for(const s of parseSQL(text).statements) {
      if(s.type==='create'&&s.keyword==='table') {
        const name=s.table[0].table;knownTables.add(name);
        for(const c of s.create_definitions||[])if(c.primary_key||c.unique)knownIndexes.push({table:name,columns:[c.column?.column],path:file});
      }
      if(s.type==='create'&&s.keyword==='index')knownIndexes.push({table:s.table.table,columns:s.index_columns.map(c=>c.column),path:file});
    }
    return {key:`d1:${query.binding?.name}`,tables:knownTables,indexes:knownIndexes,ddl:selected.map(([,s])=>s).join('\n'),known:selected.length>0};
  }
  return {queries,migrations,indexes,tables,gaps,schemaFor};
}
export function predicateColumns(node) {
  if(!node||typeof node!=='object')return [];
  if(node.type==='column_ref')return [node.column];
  return Object.values(node).flatMap(v=>Array.isArray(v)?v.flatMap(predicateColumns):predicateColumns(v));
}
export function tautology(node) {
  return !!node&&node.type==='binary_expr'&&['=','>=','<='].includes(node.operator)&&node.left?.type==='number'&&node.right?.type==='number'&&node.left.value===node.right.value;
}
