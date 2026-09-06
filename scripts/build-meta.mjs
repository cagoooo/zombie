import fs from 'node:fs';
import crypto from 'node:crypto';
export function makeBuildMeta() {
  const hash = crypto.createHash('sha256');
  function add(path) {
    if (fs.statSync(path).isDirectory())
      for (const name of fs.readdirSync(path).sort()) add(path + '/' + name);
    else {
      hash.update(path);
      hash.update(fs.readFileSync(path));
    }
  }
  for (const path of [
    'src',
    'public',
    'index.html',
    'package.json',
    'package-lock.json',
    'site.config.json',
    'vite.config.js',
    'scripts/sw-template.js',
    'scripts/recovery-inline.js',
    'scripts/build-meta.mjs',
  ])
    add(path);
  const version = JSON.parse(fs.readFileSync('package.json')).version;
  const site = JSON.parse(fs.readFileSync('site.config.json'));
  return {
    version,
    id: version + '-' + hash.digest('hex').slice(0, 12),
    sequence: Number(process.env.BUILD_SEQUENCE || process.env.GITHUB_RUN_NUMBER || 1),
    notes: site.notes,
  };
}
