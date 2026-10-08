#!/usr/bin/env node
import path from 'node:path';
import {installSkill} from './package-lib.mjs';
const args=process.argv.slice(2);
try {
  if(args.length!==2||!['--project','--skills-dir'].includes(args[0]))throw new Error('usage: npm run install-skill -- --project /APPLICATION | --skills-dir /TRUSTED/skills');
  const directory=args[0]==='--project'?path.join(path.resolve(args[1]),'.agents/skills'):path.resolve(args[1]);
  console.log(JSON.stringify(installSkill(path.join(directory,'cloudflare-cost-safety')),null,2));
} catch(error) {console.error(error.message);process.exitCode=3;}
