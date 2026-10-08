import fs from 'node:fs';
import path from 'node:path';
import { SKILL_ROOT, json, digest, sha256, inside, readSafe } from './core.mjs';

export const OFFICIAL_UPSTREAM='https://github.com/cloudflare/skills';
export function officialApplicability(inventory) {
  return [
    {name:'workers-best-practices',required:true,applies:true,reason:'Cloudflare application preflight baseline'},
    {name:'wrangler',required:inventory.toolchain==='wrangler',applies:inventory.toolchain==='wrangler',reason:inventory.toolchain==='wrangler'?'Wrangler effective configuration or release path':'Toolchain unresolved or routed outside Wrangler'},
    {name:'durable-objects',required:inventory.has_do,applies:inventory.has_do,reason:inventory.has_do?'DO class, binding, migration, alarm, or possible DO-backed framework':'No DO declaration or observed lifecycle entry'}
  ];
}
export function resolveOfficial(inventory, {root=SKILL_ROOT,lockPath='official-skills.lock.json'}={}) {
  let lock=null,problem=null;
  try { lock=JSON.parse(readSafe(root,lockPath).toString()); } catch { problem='missing'; }
  if(lock && (lock.upstream!==OFFICIAL_UPSTREAM||!/^[a-f0-9]{40}$/.test(lock.revision||'')||lock.license_verified!==true||lock.example_only===true)) problem='unapproved_source_or_revision';
  if(lock&&!problem) {
    try {if(sha256(readSafe(root,'vendor/CLOUDFLARE-LICENSE'))!==lock.license_sha256)problem='license_digest_mismatch';}
    catch {problem='license_missing';}
    if(new Set(lock.skills?.map(s=>s.name)).size!==3)problem='invalid_skill_manifest';
  }
  const skills=officialApplicability(inventory).map(app=>{
    const record={...app,upstream:lock?.upstream||null,revision:lock?.revision||null,resolved_path:null,content_digest:null,loaded_references:[],load_status:app.applies?'missing':'not_applicable',review_status:app.applies?'not_run':'not_applicable',findings:[],evidence:[],context:[]};
    if(!app.applies)return record;
    if(problem){record.load_status=problem;return record;}
    const entry=lock.skills?.find(s=>s.name===app.name);
    if(!entry?.files?.['SKILL.md']||!entry.content_tree_sha256){return record;}
    try {
      const base=inside(root,entry.resolved_local_path);
      const actual={};
      const all=[];
      function walk(dir='') {
        for(const e of fs.readdirSync(inside(base,dir),{withFileTypes:true})) {
          const f=dir?`${dir}/${e.name}`:e.name;
          if(e.isSymbolicLink())throw new Error('unreadable');
          if(e.isDirectory())walk(f); else all.push(f);
        }
      } walk();
      // Lock the entire installed reference tree, including added files, not only SKILL.md.
      if(all.sort().join('\n')!==Object.keys(entry.files).sort().join('\n'))throw new Error('digest_mismatch');
      for(const file of all.sort()) {
        const data=readSafe(base,file);
        actual[file]=sha256(data);
        if(actual[file]!==entry.files[file])throw new Error('digest_mismatch');
        // All six small reference files are relevant to a full runtime/config review.
        record.context.push({path:`${entry.resolved_local_path}/${file}`,sha256:actual[file],content:data.toString()});
        record.evidence.push({path:`${entry.resolved_local_path}/${file}`,sha256:actual[file],operation:'read'});
        if(file!=='SKILL.md')record.loaded_references.push({path:file,sha256:actual[file]});
      }
      if(digest(actual)!==entry.content_tree_sha256)throw new Error('digest_mismatch');
      record.content_digest=entry.content_tree_sha256;
      record.resolved_path=base;record.load_status='loaded';
    } catch(e) {record.load_status=['digest_mismatch','unreadable'].includes(e.message)?e.message:'unreadable';record.context=[];}
    return record;
  });
  return {skills,lock_digest:lock?digest(lock):null,context:skills.flatMap(s=>s.context),gaps:skills.filter(s=>s.required&&s.load_status!=='loaded').map(s=>({reason:`official_skill_${s.load_status}`,skill:s.name}))};
}
export function publicOfficial(skills) {return skills.map(({context,...s})=>s);}
