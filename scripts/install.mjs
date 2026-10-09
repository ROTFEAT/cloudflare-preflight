#!/usr/bin/env node
import path from 'node:path';
import {installSkill} from './package-lib.mjs';
import {installHook} from './install-hook.mjs';
const args=process.argv.slice(2);
try {
  if(![2,4].includes(args.length)||!['--project','--skills-dir'].includes(args[0])||args.length===4&&(args[0]!=='--project'||args[2]!=='--release-entry'))throw new Error('usage: npm run install-skill -- --project /APPLICATION [--release-entry /TRUSTED/scripts/release.mjs] | --skills-dir /TRUSTED/skills');
  const directory=args[0]==='--project'?path.join(path.resolve(args[1]),'.agents/skills'):path.resolve(args[1]);
  const installed=installSkill(path.join(directory,'cloudflare-cost-safety'));
  const hook=args[0]==='--project'?installHook({project:path.resolve(args[1]),skill:installed.destination,releaseEntry:args[3]}):null;
  console.log(JSON.stringify({...installed,hook},null,2));
} catch(error) {console.error(error.message);process.exitCode=3;}
