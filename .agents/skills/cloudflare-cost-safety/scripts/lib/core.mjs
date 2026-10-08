import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

export const SKILL_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const release=Object.freeze(json(path.join(SKILL_ROOT,'version.json')));
export const VERSION = release.version;
export const DISPLAY_VERSION = release.display_version;
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(v=>canonical(v)??'null').join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).filter(k=>value[k]!==undefined&&typeof value[k]!=='function'&&typeof value[k]!=='symbol').sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const digest = value => sha256(canonical(value));
export function json(file) {
  const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NONBLOCK);
  try {
    const stat=fs.fstatSync(fd);
    if(!stat.isFile()||stat.size>16*1024*1024)throw new Error('json_input_budget_exceeded');
    const data=Buffer.alloc(stat.size+1);let bytes=0;
    while(bytes<data.length){const read=fs.readSync(fd,data,bytes,data.length-bytes,bytes);if(!read)break;bytes+=read;}
    if(bytes!==stat.size)throw new Error('json_input_changed_during_read');
    return JSON.parse(data.subarray(0,bytes).toString('utf8'));
  } finally {fs.closeSync(fd);}
}
export const asset = name => path.join(SKILL_ROOT, 'assets', name);
export function safeWrite(file,data) {
  const absolute=path.resolve(file);let cursor=path.parse(absolute).root;
  for(const part of absolute.slice(cursor.length).split(path.sep)) {
    cursor=path.join(cursor,part);
    try{if(fs.lstatSync(cursor).isSymbolicLink())throw new Error('output_symlink_rejected');}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  fs.mkdirSync(path.dirname(absolute),{recursive:true});
  const fd=fs.openSync(absolute,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_TRUNC|fs.constants.O_NOFOLLOW,0o600);
  try{fs.writeFileSync(fd,data);}finally{fs.closeSync(fd);}
}
export function writeJSON(file, value) {
  safeWrite(file,`${JSON.stringify(value, null, 2)}\n`);
}
export function inside(root, relative) {
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw new Error('unsafe_path');
  const base = fs.realpathSync(root);
  const target = path.resolve(base, relative);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw new Error('path_escape');
  let cursor = base;
  for (const segment of path.relative(base, target).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, segment);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('symlink_rejected');
  }
  return target;
}
export const sensitiveName = name => /(^|\/)(?:\.env(?:\..*)?|\.dev\.vars.*|.*\.(?:pem|key|p12)|credentials(?:\..*)?|secrets?(?:\..*)?)$/i.test(name);
export const sensitiveKey = key => /(?:secret|password|token|api[_-]?key|private[_-]?key|authorization|credential)/i.test(key);
export function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k,v]) => [k, sensitiveKey(k) ? '[REDACTED:UNVERIFIABLE]' : redact(v)]));
  if (typeof value !== 'string') return value;
  return value.replace(/((?:secret|password|token|api[_-]?key|authorization)\s*["']?\s*[:=]\s*)(["'`])[^\n]*?\2/gi, '$1"[REDACTED:UNVERIFIABLE]"')
    .replace(/(?:Bearer\s+)[\w.+/=-]+/gi, 'Bearer [REDACTED]')
    .replace(/(?:sk-(?:live-|proj-)?[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,})/g, '[REDACTED:UNVERIFIABLE]');
}
export function readSafe(root, relative, maxBytes = 1024 * 1024) {
  if (sensitiveName(relative)) throw new Error('credential_file_excluded');
  const file = inside(root, relative);
  const stat = fs.statSync(file);
  if (!stat.isFile() || stat.size > maxBytes) throw new Error('file_budget_exceeded');
  return fs.readFileSync(file);
}
const ignored = new Set(['.git', 'node_modules', '.cost-safety', '.wrangler', 'coverage', '__pycache__']);
export function snapshot(root, { maxFiles = 2000, maxBytes = 24 * 1024 * 1024, exclude = [] } = {}) {
  const files = [], gaps = [], texts = new Map();
  let total = 0;
  function walk(dir = '') {
    for (const entry of fs.readdirSync(inside(root, dir), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const name = dir ? `${dir}/${entry.name}` : entry.name;
      if (ignored.has(entry.name) || exclude.some(e => name === e || name.startsWith(`${e}/`)) || sensitiveName(name)) continue;
      if (files.length >= maxFiles) { gaps.push({ path: name, reason: 'file_count_budget' }); return; }
      if (entry.isSymbolicLink()) { gaps.push({ path: name, reason: 'symlink_rejected' }); continue; }
      if (entry.isDirectory()) { walk(name); continue; }
      try {
        const data = readSafe(root, name);
        total += data.length;
        if (total > maxBytes) { gaps.push({ path: name, reason: 'total_byte_budget' }); return; }
        const isText = !data.includes(0);
        const raw = isText ? data.toString('utf8') : null;
        const clean = isText ? redact(raw) : data;
        if (isText && clean !== raw) gaps.push({ path: name, reason: 'inline_sensitive_value_not_hashed' });
        files.push({ path: name, sha256: sha256(clean), bytes: data.length });
        if (isText) texts.set(name, raw);
      } catch (e) { gaps.push({ path: name, reason: e.message }); }
    }
  }
  walk();
  let commit = null;
  try { commit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { encoding:'utf8', stdio:['ignore','pipe','ignore'], timeout:2000 }).trim(); } catch {}
  return { files, texts, gaps, digest: digest(files), commit, total_bytes: total };
}
export const precedence = statuses => statuses.includes('BLOCK') ? 'BLOCK' : statuses.includes('INCOMPLETE') ? 'INCOMPLETE' : statuses.includes('REVIEW') ? 'REVIEW' : 'PASS';
export function exitCode(report) {
  if (report.overall_status === 'BLOCK') return 1;
  if (report.tool_errors?.length) return 3;
  return ['ALLOW', 'ALLOW_WITH_APPROVAL'].includes(report.predeploy_gate_status) ? 0 : 2;
}
