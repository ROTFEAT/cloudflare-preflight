import path from 'node:path';
import fs from 'node:fs';
import { parse as parseJSONC } from 'jsonc-parser';
import TOML from '@iarna/toml';
import {createRequire} from 'node:module';
import { readSafe, inside, digest, redact, sha256 } from './core.mjs';

const nonInherited = ['vars','durable_objects','kv_namespaces','r2_buckets','d1_databases','queues','services','workflows','analytics_engine_datasets','ratelimits','dispatch_namespaces','unsafe'];
export function loadConfig(root, file, environment = 'production') {
  const gaps = [];
  const selected = file || ['wrangler.jsonc','wrangler.json','wrangler.toml'].find(f => fs.existsSync(inside(root,f)));
  if (!selected) return { file:null, effective:{}, digest:null, gaps:[{ reason: 'effective_config_missing' }], bindings:[], toolchain:'unknown' };
  if (/\.(?:ts|js|mjs|cjs)$/.test(selected)) return { file:selected, effective:{}, digest:null, gaps:[{path:selected,reason:'dynamic_config_not_executed'}],bindings:[],toolchain:'unsupported' };
  let raw;
  try {
    const text = readSafe(root,selected).toString();
    if (selected.endsWith('.toml')) raw = TOML.parse(text);
    else {
      const errors = [];
      raw = parseJSONC(text,errors,{ allowTrailingComma:true, disallowComments:false });
      if (errors.length) throw new Error('invalid_jsonc');
    }
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid_config_object');
  } catch { return { file:selected,effective:{},digest:null,gaps:[{path:selected,reason:'config_parse_or_read_failed'}],bindings:[],toolchain:'wrangler' }; }
  let effective = { ...raw };
  delete effective.env;
  const namedEnvironment=environment!=='default'&&(environment!=='production'||!!raw.env?.production);
  if (namedEnvironment) {
    if (!raw.env?.[environment]) gaps.push({path:selected,reason:`environment_missing:${environment}`});
    else {
      for (const key of nonInherited) delete effective[key];
      Object.assign(effective, raw.env[environment]);
      if (!raw.env[environment].name && raw.name) effective.name = `${raw.name}-${environment}`;
    }
  }
  for(const key of ['main'])if(typeof effective[key]==='string'&&!path.posix.isAbsolute(effective[key]))effective[key]=path.posix.normalize(path.posix.join(path.posix.dirname(selected),effective[key]));
  if(effective.assets?.directory&&!path.posix.isAbsolute(effective.assets.directory))effective.assets={...effective.assets,directory:path.posix.normalize(path.posix.join(path.posix.dirname(selected),effective.assets.directory))};
  const bindings = [];
  function add(kind, items, key = 'binding') {
    for (const entry of items || []) bindings.push({ kind, name:entry[key] || null, status:'declared', evidence:{path:selected,start_line:1}, config:redact(entry), remote:entry.remote === true });
  }
  add('durable_object',effective.durable_objects?.bindings,'name');
  add('d1',effective.d1_databases); add('kv',effective.kv_namespaces); add('r2',effective.r2_buckets);
  add('queue_producer',effective.queues?.producers); add('queue_consumer',effective.queues?.consumers,'queue');
  add('service',effective.services); add('workflow',effective.workflows);
  if(effective.ai)add('ai',[effective.ai]);
  if(effective.vectorize)add('vectorize',effective.vectorize);
  add('rate_limit',effective.ratelimits,'name');
  if (bindings.some(b=>b.remote)) gaps.push({path:selected,reason:'remote_binding_forbidden_in_local_tests'});
  if (Object.keys(raw).some(k=>k.includes('${')) || JSON.stringify(effective).includes('${')) gaps.push({path:selected,reason:'unresolved_config_template'});
  if (!effective.compatibility_date && effective.main) gaps.push({path:selected,reason:'compatibility_date_unknown'});
  return { file:selected,effective,bindings,gaps,digest:digest(redact(effective)),toolchain:'wrangler', environments:Object.keys(raw.env||{}),named_environment:namedEnvironment, static_only:!!effective.assets&&!effective.main };
}

export function toolVersions(texts,root,wranglerPackage) {
  const versions = { node:process.version,typescript:'5.9.3',wrangler:null,wrangler_locked:null,wrangler_source:'unknown',wrangler_package_digest:null,lockfiles:[] };
  for (const [file,text] of texts) {
    if (/(?:package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?)$/.test(file)) versions.lockfiles.push(file);
    if (file.endsWith('package-lock.json')) {
      try { const lock=JSON.parse(text); versions.wrangler_locked=lock.packages?.['node_modules/wrangler']?.version || lock.dependencies?.wrangler?.version || null; } catch {}
    }
    // Other lock formats are inventoried; a range in package.json is not a pinned version.
  }
  try {
    let file=wranglerPackage,source='explicit_publisher_package';
    if(!file&&root&&fs.existsSync(path.join(root,'node_modules/wrangler/package.json'))){file=inside(root,'node_modules/wrangler/package.json');source='candidate_installed_package';}
    if(!file){file=createRequire(import.meta.url).resolve('wrangler/package.json');source='trusted_tool_installed_package';}
    const stat=fs.statSync(file);if(!stat.isFile()||stat.size>1024*1024)throw new Error('invalid_tool_metadata');
    const bytes=fs.readFileSync(file),pkg=JSON.parse(bytes);if(pkg.name!=='wrangler'||!/^\d+\.\d+\.\d+/.test(pkg.version))throw new Error('invalid_tool_metadata');
    versions.wrangler=pkg.version;versions.wrangler_source=source;versions.wrangler_package_digest=sha256(bytes);
  } catch {}
  return versions;
}
