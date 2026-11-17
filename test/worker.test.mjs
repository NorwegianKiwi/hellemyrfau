import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { handleRequest, purgeArchived, archiveCutoff, verifyTurnstile } from '../worker/index.mjs';
import { authenticate, verifyGoogleToken } from '../worker/auth.mjs';
import { SignJWT, generateKeyPair } from 'jose';

// Ekte SQLite med D1s prepare/bind/batch-grensesnitt. batch bruker én transaksjon.
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON');
  sqlite.exec(readFileSync(new URL('../worker/migrations/0001_saker.sql', import.meta.url), 'utf8'));
  const db = {
    sqlite,
    prepare(sql) {
      let args = [];
      return {
        bind(...values) { args = values; return this; },
        async first() { return sqlite.prepare(sql).get(...args) || null; },
        async all() { return { results: sqlite.prepare(sql).all(...args) }; },
        async run() { return { meta: sqlite.prepare(sql).run(...args) }; }
      };
    },
    batch(statements) {
      const result = (db.pending || Promise.resolve()).then(async () => {
        sqlite.exec('BEGIN');
        try { const results = []; for (const s of statements) results.push(await s.run()); sqlite.exec('COMMIT'); return results; }
        catch (error) { sqlite.exec('ROLLBACK'); throw error; }
      });
      db.pending = result.catch(() => {});
      return result;
    }
  };
  return db;
}
const origin = 'https://hellemyrfau.no';
const user = { epost: 'admin@example.test', navn: 'Testadministrator' };
const services = {
  authenticate: async req => req.headers.get('authorization') === 'Bearer admin' ? user : null,
  verifyTurnstile: async token => token === 'valid'
};
function setup() {
  const env = { DB: database(), ALLOWED_ORIGINS: origin, ADMIN_EPOSTER: user.epost,
    GOOGLE_CLIENT_ID: 'client-id', SUBMISSION_ORIGINS: origin, SUBMISSIONS_OPEN: 'true', TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_HOSTNAMES: 'hellemyrfau.no',
    SUBMISSION_LIMITER: { limit: async () => ({ success: true }) } };
  const call = (path, method = 'GET', data, token = 'admin', extra = {}) => handleRequest(new Request('https://api.test' + path, {
    method, headers: { origin, 'cf-connecting-ip': '192.0.2.1', 'content-type': 'application/json', authorization: 'Bearer ' + token, ...extra },
    body: data === undefined ? undefined : JSON.stringify(data)
  }), env, services);
  const message = { id: crypto.randomUUID(), melding: 'En oppdiktet sak', tema: '', navn: '', epost: '', trinn: '', turnstileToken: 'valid' };
  return { env, call, message };
}

test('innsending lagres én gang; endret innhold kan ikke overskrive samme ID', async () => {
  const { env, call, message } = setup();
  assert.equal((await call('/api/saker', 'POST', message)).status, 201);
  assert.equal((await call('/api/saker', 'POST', message)).status, 201);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM saker').get().n, 1);
  assert.equal((await call('/api/saker', 'POST', { ...message, melding: 'Endret innhold' })).status, 409);
  const response = await call('/api/admin');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const { saker } = await response.json();
  assert.equal(saker[0].melding, message.melding);
  assert.equal(saker[0].epost, '');
  assert.equal(saker[0].fingerprint, undefined);
});

test('tilgang, CORS og metoder avvises uten lekkasje', async () => {
  const { env, call } = setup();
  assert.equal((await call('/api/admin', 'GET', undefined, 'invalid')).status, 401);
  assert.equal((await call('/api/admin', 'GET', undefined, '', { origin: 'https://evil.test' })).status, 403);
  env.ADMIN_EPOSTER = 'someone-else@example.test';
  assert.equal((await call('/api/admin')).status, 401);
  assert.equal((await call('/api/saker')).status, 405);
  const response = await call('/api/admin', 'OPTIONS', undefined, '', { 'access-control-request-method': 'POST' });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
  assert.equal((await call('/missing')).status, 404);
});

test('ugyldig innhold, robotfelt, botsjekk og stengt mottak avvises', async () => {
  const { env, call, message } = setup();
  for (const patch of [{ melding: 'a' }, { melding: 'a'.repeat(2001) }, { melding: 42 }, { epost: 'ugyldig' }, { id: 'not-an-id' }, { 'bot-felt': 'spam' }, { turnstileToken: 'invalid' }]) {
    assert.equal((await call('/api/saker', 'POST', { ...message, ...patch })).status, 400);
  }
  assert.equal((await call('/api/saker', 'POST', { ...message, melding: 'a'.repeat(40000) })).status, 413);
  assert.equal((await call('/api/saker', 'POST', message, '', { 'content-type': 'text/plain' })).status, 415);
  env.SUBMISSIONS_OPEN = 'false';
  assert.equal((await call('/api/saker', 'POST', message)).status, 503);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM saker').get().n, 0);
});

test('preview tillater testinnsending og admin, men stenger endelige domener', async () => {
  const { env, call, message } = setup();
  const preview = 'https://hellemyrfau.github.io';
  // Preview-policyen testes separat fra konfigurasjonen for domenelanseringen.
  Object.assign(env, {
    ALLOWED_ORIGINS: [origin, 'https://www.hellemyrfau.no', preview].join(','),
    SUBMISSION_ORIGINS: preview, SUBMISSIONS_OPEN: 'true'
  });
  for (const blocked of [origin, 'https://www.hellemyrfau.no']) {
    const response = await call('/api/saker', 'POST', message, '', { origin: blocked });
    assert.equal(response.status, 503);
  }
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM saker').get().n, 0);
  const headers = { origin: preview };
  const preflight = await call('/api/saker', 'OPTIONS', undefined, '', { ...headers, 'access-control-request-method': 'POST' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), preview);
  assert.equal((await call('/api/admin/konfig', 'GET', undefined, '', headers)).status, 200);
  assert.equal((await call('/api/admin', 'GET', undefined, '', headers)).status, 401);
  assert.equal((await call('/api/saker', 'POST', message, '', headers)).status, 201);
  assert.equal((await call('/api/admin', 'GET', undefined, 'admin', headers)).status, 200);
  for (const scope of [undefined, '', preview + '.evil.test']) {
    env.SUBMISSION_ORIGINS = scope;
    assert.equal((await call('/api/saker', 'POST', { ...message, id: crypto.randomUUID() }, '', headers)).status, 503);
  }
  env.SUBMISSION_ORIGINS = preview;
  env.SUBMISSIONS_OPEN = 'false';
  assert.equal((await call('/api/saker', 'POST', message, '', headers)).status, 503);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM saker').get().n, 1);
});

test('lanseringskonfigurasjonen holder mottak stengt og avviser preview også ved åpning', async () => {
  const { env, call, message } = setup();
  const { vars } = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  Object.assign(env, vars);
  assert.equal(env.SUBMISSIONS_OPEN, 'false');
  for (const site of [origin, 'https://www.hellemyrfau.no']) {
    assert.equal((await call('/api/saker', 'POST', message, '', { origin: site })).status, 503);
    assert.equal((await call('/api/admin', 'GET', undefined, 'admin', { origin: site })).status, 200);
    assert.equal((await call('/api/admin', 'GET', undefined, '', { origin: site })).status, 401);
  }
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM saker').get().n, 0);
  env.SUBMISSIONS_OPEN = 'true';
  for (const site of [origin, 'https://www.hellemyrfau.no']) {
    assert.equal((await call('/api/saker', 'POST', { ...message, id: crypto.randomUUID() }, '', { origin: site })).status, 201);
  }
  for (const site of ['https://hellemyrfau.github.io', 'https://evil.test']) {
    const response = await call('/api/saker', 'POST', message, '', { origin: site });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    assert.equal((await call('/api/admin', 'GET', undefined, 'admin', { origin: site })).status, 403);
  }
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM saker').get().n, 2);
});

test('trafikkgrense gir Retry-After og skriver ikke til databasen', async () => {
  const { env, call, message } = setup();
  env.SUBMISSION_LIMITER.limit = async ({ key }) => { assert.equal(key, '192.0.2.1'); return { success: false }; };
  const response = await call('/api/saker', 'POST', message);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM saker').get().n, 0);
});

test('admin lagrer samtidige notater, svar, ansvarlig og historikk uten å erstatte hele saken', async () => {
  const { env, call, message } = setup();
  await call('/api/saker', 'POST', message);
  const responses = await Promise.all([
    call('/api/admin', 'POST', { id: message.id, notatNy: 'Notat én' }),
    call('/api/admin', 'POST', { id: message.id, notatNy: 'Notat to' })
  ]);
  assert.ok(responses.every(r => r.status === 200));
  let response = await call('/api/admin', 'POST', { id: message.id, svar: 'Svartekst', ansvarlig: user.epost });
  let { sak } = await response.json();
  assert.equal(sak.notater.length, 2);
  assert.equal(sak.svar.length, 1);
  assert.equal(sak.logg.length, 3);
  assert.equal(sak.status, 'besvart');
  assert.equal(sak.ansvarlig, user.epost);
  assert.equal((await call('/api/admin', 'POST', { id: message.id, ansvarlig: 'unknown@example.test' })).status, 400);
  assert.equal((await call('/api/admin', 'POST', { id: message.id, status: 'invalid' })).status, 400);
  assert.equal((await call('/api/admin', 'POST', { id: message.id, notatNy: 'x'.repeat(5001) })).status, 400);
  await call('/api/admin', 'POST', { id: message.id, status: 'arkivert' });
  const archived = env.DB.sqlite.prepare('SELECT arkivert FROM saker').get().arkivert;
  await call('/api/admin', 'POST', { id: message.id, status: 'arkivert' });
  assert.equal(env.DB.sqlite.prepare('SELECT arkivert FROM saker').get().arkivert, archived);
  response = await call('/api/admin', 'POST', { id: message.id, svar: 'Svar på arkivert sak' });
  assert.equal((await response.json()).sak.status, 'arkivert');
  await call('/api/admin', 'POST', { id: message.id, status: 'under behandling' });
  assert.equal(env.DB.sqlite.prepare('SELECT arkivert FROM saker').get().arkivert, null);
  assert.equal((await call('/api/admin', 'DELETE', { id: message.id })).status, 200);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM hendelser').get().n, 0);
});

test('svarskjema beholder tidligere ansvarlig etter at administratorens tilgang fjernes', async () => {
  const { env, call, message } = setup();
  const previousOwner = 'tidligere@example.test';
  env.ADMIN_EPOSTER += ',' + previousOwner;
  await call('/api/saker', 'POST', message);
  const assigned = await call('/api/admin', 'POST', { id: message.id, ansvarlig: previousOwner });
  assert.equal(assigned.status, 200);
  const { sak } = await assigned.json();
  env.ADMIN_EPOSTER = user.epost;

  const html = readFileSync(new URL('../fau-admin/admin/index.html', import.meta.url), 'utf8');
  const handler = html.slice(html.indexOf('  $("skriv").addEventListener("submit",'), html.indexOf('  $("logg-ut").addEventListener'));
  let submit, sent;
  const context = {
    $: () => ({ addEventListener: (event, callback) => { submit = callback; } }),
    tekst: { value: 'Svar fra nåværende administrator', style: {} },
    saker: [sak], valgt: message.id, modus: 'svar', meg: user,
    endre: async data => {
      sent = data;
      const response = await call('/api/admin', 'POST', { id: message.id, ...data });
      assert.equal(response.status, 200);
      return (await response.json()).sak;
    }
  };
  runInNewContext(handler, context);
  await submit({ preventDefault() {} });
  assert.equal('ansvarlig' in sent, false);
  const result = await (await call('/api/admin')).json();
  assert.equal(result.saker[0].ansvarlig, previousOwner);
  assert.equal(result.saker[0].svar.length, 1);
  assert.equal(result.saker[0].status, 'besvart');
  assert.equal(result.saker[0].logg.length, 2);
  assert.equal((await call('/api/admin', 'POST', { id: message.id, ansvarlig: previousOwner })).status, 400);

  await call('/api/admin', 'POST', { id: message.id, ansvarlig: '' });
  context.saker[0].ansvarlig = '';
  context.tekst.value = 'Svar på sak uten ansvarlig';
  await submit({ preventDefault() {} });
  assert.equal(sent.ansvarlig, user.epost);
});

test('feil i historikklagring ruller tilbake statusendring; detaljer lekkes ikke', async () => {
  const { env, call, message } = setup();
  await call('/api/saker', 'POST', message);
  env.DB.sqlite.exec("CREATE TRIGGER fail_log BEFORE INSERT ON hendelser BEGIN SELECT RAISE(ABORT, 'private details'); END");
  const response = await call('/api/admin', 'POST', { id: message.id, status: 'arkivert', notatNy: 'Hemmelig tekst' });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /private details|Hemmelig/);
  assert.equal(env.DB.sqlite.prepare('SELECT status FROM saker').get().status, 'ny');
});

test('sletter bare saker som har vært arkivert i minst tolv måneder, med tilhørende hendelser', async () => {
  const { env, call, message } = setup();
  const now = new Date('2026-11-15T12:00:00.000Z');
  for (const [status, date] of [['arkivert', '2025-11-15T12:00:00.000Z'], ['arkivert', '2025-11-15T12:00:00.001Z'], ['ny', null]]) {
    const id = crypto.randomUUID();
    await call('/api/saker', 'POST', { ...message, id });
    await call('/api/admin', 'POST', { id, notatNy: 'Internt notat' });
    env.DB.sqlite.prepare('UPDATE saker SET status = ?, arkivert = ? WHERE id = ?').run(status, date, id);
  }
  await purgeArchived(env, now);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM saker').get().n, 2);
  assert.equal(env.DB.sqlite.prepare('SELECT COUNT(*) AS n FROM hendelser').get().n, 4);
  assert.equal(archiveCutoff(new Date('2024-02-29T12:00:00Z')), '2023-02-28T12:00:00.000Z');
});

test('Google-signatur, mottaker, utløp og verifisert e-post kontrolleres', async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const sign = async (patch = {}, audience = 'client', issuer = 'https://accounts.google.com', expiry = '1h') => new SignJWT({ email: user.epost, email_verified: true, ...patch })
    .setProtectedHeader({ alg: 'RS256' }).setSubject('google-user').setAudience(audience).setIssuer(issuer).setExpirationTime(expiry).sign(privateKey);
  const good = await sign();
  assert.equal((await verifyGoogleToken(good, 'client', publicKey)).epost, user.epost);
  for (const token of [await sign({}, 'other'), await sign({}, 'client', 'https://evil.test'), await sign({}, 'client', 'accounts.google.com', '0s'), await sign({ email_verified: false })]) {
    await assert.rejects(() => verifyGoogleToken(token, 'client', publicKey));
  }
  const otherKeys = await generateKeyPair('RS256');
  await assert.rejects(() => verifyGoogleToken(good, 'client', otherKeys.publicKey));
  assert.equal(await authenticate(new Request('https://api.test'), { GOOGLE_CLIENT_ID: 'client' }), null);
  assert.equal(await authenticate(new Request('https://api.test', { headers: { authorization: 'Bearer garbage' } }), { GOOGLE_CLIENT_ID: 'client', ADMIN_EPOSTER: user.epost }), null);
});

test('Turnstile krever gyldig resultat, riktig vert og riktig handling', async t => {
  let result = { success: true, hostname: 'hellemyrfau.no', action: 'send-sak' };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(JSON.parse(options.body).secret, 'secret');
    return Response.json(result);
  });
  const env = { TURNSTILE_SECRET_KEY: 'secret', TURNSTILE_HOSTNAMES: 'hellemyrfau.no' };
  assert.equal(await verifyTurnstile('token', env), true);
  for (const patch of [{ success: false }, { hostname: 'evil.test' }, { action: 'other' }]) {
    result = { success: true, hostname: 'hellemyrfau.no', action: 'send-sak', ...patch };
    assert.equal(await verifyTurnstile('token', env), false);
  }
});


test('lanseringskonfigurasjonen godtar Turnstile bare fra endelige verter', async t => {
  const { vars: env } = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  env.TURNSTILE_SECRET_KEY = 'secret';
  let result = { success: true, hostname: 'hellemyrfau.no', action: 'send-sak' };
  t.mock.method(globalThis, 'fetch', async () => Response.json(result));
  for (const hostname of ['hellemyrfau.no', 'www.hellemyrfau.no']) {
    result.hostname = hostname;
    assert.equal(await verifyTurnstile('token', env), true);
  }
  for (const hostname of ['hellemyrfau.github.io', 'evil.test']) {
    result.hostname = hostname;
    assert.equal(await verifyTurnstile('token', env), false);
  }
});

test('Turnstile-testnøkkel godtas bare med lokale originer', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ success: true, hostname: 'example.com' }));
  const env = { TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA', ALLOWED_ORIGINS: 'http://localhost:8000' };
  assert.equal(await verifyTurnstile('XXXX.DUMMY.TOKEN.XXXX', env), true);
  env.ALLOWED_ORIGINS = 'https://hellemyrfau.no';
  assert.equal(await verifyTurnstile('XXXX.DUMMY.TOKEN.XXXX', env), false);
  env.ALLOWED_ORIGINS = '';
  assert.equal(await verifyTurnstile('XXXX.DUMMY.TOKEN.XXXX', env), false);
});
