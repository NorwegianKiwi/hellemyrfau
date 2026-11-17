import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const runBuild = (args = [], extra = {}) => spawnSync(process.execPath, ['scripts/build.mjs', ...args], {
  cwd: root, env: { ...process.env, PUBLIC_API_BASE: '', PUBLIC_TURNSTILE_SITE_KEY: '', ...extra }, encoding: 'utf8'
});
const read = path => readFile(resolve(root, path), 'utf8');

test('bygg publiserer bare offentlige filer og isolerer forhåndsvisninger', async () => {
  let result = runBuild();
  assert.equal(result.status, 0, result.stderr);
  let config = await read('dist/assets/config.js');
  assert.match(config, /"enabled":false/);
  assert.doesNotMatch(config, /workers\.dev|localhost/);
  const entries = await readdir(resolve(root, 'dist'));
  for (const name of ['README.md', 'wrangler.jsonc', 'worker', '.dev.vars', 'node_modules', 'package.json', 'CNAME']) assert.ok(!entries.includes(name), name);
  for (const name of ['index.html', 'moter.ics', 'dokumenter/smarttelefon-i-barneskolen.pdf', 'fonts/sofia-sans-var.woff2', 'admin/index.html', 'assets/api.js', '.nojekyll']) {
    assert.ok((await readFile(resolve(root, 'dist', name))).length >= 0);
  }
  assert.equal(runBuild(['--production']).status, 1);
  assert.equal(runBuild(['--production'], { PUBLIC_API_BASE: 'http://unsafe.test', PUBLIC_TURNSTILE_SITE_KEY: 'public-key' }).status, 1);
  assert.equal(runBuild(['--production'], { PUBLIC_API_BASE: 'https://user:password@api.test', PUBLIC_TURNSTILE_SITE_KEY: 'public-key' }).status, 1);
  assert.equal(runBuild(['--production'], { PUBLIC_API_BASE: 'https://api.test', PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA' }).status, 1);
  result = runBuild(['--production'], { PUBLIC_API_BASE: 'https://api.example.workers.dev', PUBLIC_TURNSTILE_SITE_KEY: 'public-key' });
  assert.equal(result.status, 0, result.stderr);
  config = await read('dist/assets/config.js');
  assert.match(config, /"enabled":true/);
  assert.match(config, /https:\/\/api.example.workers.dev/);
  assert.doesNotMatch(config, /ADMIN_EPOSTER|TURNSTILE_SECRET_KEY|localhost/);
  assert.equal(await read('dist/CNAME'), 'hellemyrfau.no\n');
  for (const file of ['dist/index.html', 'dist/admin/index.html']) {
    const html = await read(file);
    const source = /<script type="module">([\s\S]*?)<\/script>/.exec(html)?.[1];
    assert.ok(source, file + ' må laste API-modulen');
    assert.match(source, /from "\/assets\/api\.js"/);
    const syntax = spawnSync(process.execPath, ['--input-type=module', '--check'], { input: source, encoding: 'utf8' });
    assert.equal(syntax.status, 0, syntax.stderr);
  }

  result = runBuild(['--local']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(await read('dist/assets/config.js'), /http:\/\/localhost:8787/);
  assert.ok(!(await readdir(resolve(root, 'dist'))).includes('CNAME'));
  assert.equal(runBuild().status, 0);
});
