import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';

test('retry etter tapt svar og omlasting gjenoppretter hele meldingen og samme ID', async () => {
  const html = await readFile(new URL('../fau-nettside/index.html', import.meta.url), 'utf8');
  const api = await readFile(new URL('../shared/api.js', import.meta.url), 'utf8');
  const handler = html.slice(html.indexOf('  sakSkjema.addEventListener("submit",'), html.indexOf('\n  document.addEventListener("click",', html.indexOf('  sakSkjema.addEventListener("submit",')));
  assert.ok(handler.includes('submissionId(fields)'));

  const fields = { melding: 'En oppdiktet sak', tema: 'Annet', navn: 'Testforelder', epost: 'forelder@example.test', trinn: '3. trinn', 'bot-felt': '' };
  const originalFields = { ...fields };
  const stored = new Map();
  const cases = new Map();
  const requests = [];
  const control = { disabled: false, classList: { add() {}, remove() {} }, querySelector: () => ({ textContent: '' }) };
  let submit;
  let challenges = 0;
  let context = {
    crypto: webcrypto, TextEncoder,
    sessionStorage: { getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value), removeItem: key => stored.delete(key) },
    FormData: class {
      constructor() { this.data = new Map(Object.entries(fields)); }
      delete(key) { this.data.delete(key); }
      [Symbol.iterator]() { return this.data[Symbol.iterator](); }
    },
    document: { getElementById: () => control },
    sakSkjema: { addEventListener: (event, callback) => { assert.equal(event, 'submit'); submit = callback; }, querySelectorAll: () => [control] },
    sakMelding: { value: fields.melding }, sender: false, kanSende: true, ventTil: 0,
    challenge: async () => {
      const token = 'challenge-' + ++challenges;
      fields['cf-turnstile-response'] = token;
      return token;
    },
    request: async (path, { data }) => {
      requests.push(data);
      cases.set(data.id, data);
      if (requests.length <= 2) throw new Error('Response lost after saving');
      return { mottatt: true };
    },
    slettUtkast() {}, visSakSteg() {}, sakFremdrift: [], setTimeout() {}
  };
  // Use the real fingerprint implementation and the actual form submit handler.
  const script = api.slice(api.indexOf('let attempt;')).replaceAll('export ', '') + '\n' + handler;
  runInNewContext(script, context);
  const event = { preventDefault() {} };
  await submit(event);
  await submit(event);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].id, requests[1].id);
  assert.notEqual(requests[0].turnstileToken, requests[1].turnstileToken);
  assert.equal('cf-turnstile-response' in requests[1], false);
  assert.equal(cases.size, 1);

  // Simulate a reload: fresh module state and empty form, same tab storage.
  for (const name of Object.keys(fields)) delete fields[name];
  const restoredControls = Object.keys(originalFields).map(name => ({
    name, type: ['tema', 'trinn'].includes(name) ? 'radio' : 'text',
    get value() { return this.type === 'radio' ? originalFields[name] : fields[name] || ''; },
    set value(value) { fields[name] = value; },
    set checked(value) { if (value) fields[name] = originalFields[name]; }
  }));
  context = { ...context, sakMelding: { value: '' },
    sakSkjema: { ...context.sakSkjema, querySelectorAll: selector => selector === 'input, textarea' ? restoredControls : [control] }
  };
  const open = html.slice(html.indexOf('  function aapneSak(valg)'), html.indexOf('  window.aapneSak ='));
  const restore = open.slice(open.indexOf('    if (!sakMelding.value)'), open.indexOf('    if (valg.tema)'));
  runInNewContext(script + '\n' + restore, context);
  assert.deepEqual(fields, originalFields);
  context.sakMelding.value = fields.melding;
  await submit(event);
  assert.equal(requests[2].id, requests[0].id);
  assert.equal(cases.size, 1);
  assert.equal(stored.has('fau-innsending'), false);

  fields.melding = context.sakMelding.value = 'En endret sak';
  await submit(event);
  assert.notEqual(requests[3].id, requests[2].id);
  assert.equal(cases.size, 2);

  await context.submissionId(fields);
  context.clearSubmission();
  assert.equal(stored.has('fau-innsending'), false);
  assert.equal(context.pendingSubmission(), undefined);
});
