import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {sha256,writeJSON,VERSION,DISPLAY_VERSION} from '../.agents/skills/cloudflare-cost-safety/scripts/lib/core.mjs';

export const repository=fileURLToPath(new URL('../',import.meta.url));
export const skillSource=path.join(repository,'.agents/skills/cloudflare-cost-safety');

export function installSkill(destination) {
  if(fs.existsSync(destination))throw new Error('destination_exists: choose an empty destination; installation never overwrites skills');
  const lock=JSON.parse(fs.readFileSync(path.join(repository,'package-lock.json'),'utf8'));
  const dependencies=Object.entries(lock.packages).filter(([name,p])=>name&&!p.dev&&!p.devOptional);
  for(const [name] of dependencies)if(!fs.existsSync(path.join(repository,name,'package.json')))throw new Error(`dependency_not_prepared:${name}; run npm ci --ignore-scripts in the trusted preparation stage`);
  fs.mkdirSync(path.dirname(destination),{recursive:true});
  try {
    fs.cpSync(skillSource,destination,{recursive:true,filter:source=>!source.split(path.sep).some(p=>p==='node_modules'||p==='__pycache__')});
    const manifest=[];
    for(const [name,metadata] of dependencies) {
      const from=path.join(repository,name),to=path.join(destination,name);
      fs.cpSync(from,to,{recursive:true,dereference:false});
      const files={};
      function walk(dir='') {
        for(const entry of fs.readdirSync(path.join(to,dir),{withFileTypes:true})) {
          const relative=dir?`${dir}/${entry.name}`:entry.name;
          if(entry.isSymbolicLink())throw new Error(`dependency_symlink_rejected:${name}/${relative}`);
          if(entry.isDirectory())walk(relative);
          else files[relative]=sha256(fs.readFileSync(path.join(to,relative)));
        }
      }
      walk();
      const pkg=JSON.parse(fs.readFileSync(path.join(to,'package.json'),'utf8'));
      if(pkg.version!==metadata.version)throw new Error(`prepared_dependency_version_mismatch:${name}`);
      manifest.push({path:name,name:pkg.name,version:metadata.version,license:pkg.license||'see bundled license',npm_integrity:metadata.integrity,files});
    }
    writeJSON(path.join(destination,'runtime-dependencies.json'),{schema_version:'1.0',network_preparation:'npm ci --ignore-scripts',packages:manifest});
    fs.copyFileSync(path.join(repository,'LICENSE'),path.join(destination,'LICENSE'));
    return {destination,version:VERSION,display_version:DISPLAY_VERSION,dependencies:manifest.length,official_revision:JSON.parse(fs.readFileSync(path.join(destination,'official-skills.lock.json'))).revision};
  } catch(error) {fs.rmSync(destination,{recursive:true,force:true});throw error;}
}
