import { addresses, authenticate } from "./auth.mjs";

const STATUSES = ["ny", "under behandling", "besvart", "arkivert"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
const list = value => String(value || "").split(",").map(s => s.trim()).filter(Boolean);
function text(value, max, min = 0) {
  if (value === undefined) value = "";
  if (typeof value !== "string" || value.trim().length < min || value.length > max) fail(400, "Kontroller feltene og lengden på meldingen.");
  return value.trim();
}
async function body(req) {
  if (!(req.headers.get("content-type") || "").startsWith("application/json")) fail(415, "Forventet JSON.");
  // Les med grense også når Content-Length mangler eller er feil.
  const reader = req.body?.getReader();
  if (!reader) fail(400, "Mangler innhold.");
  const chunks = []; let size = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 32768) { await reader.cancel(); fail(413, "Meldingen er for stor."); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let data;
  try { data = JSON.parse(new TextDecoder().decode(bytes)); } catch { fail(400, "Ugyldig innhold."); }
  if (!data || typeof data !== "object" || Array.isArray(data)) fail(400, "Ugyldig innhold.");
  return data;
}
const fingerprint = async data => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(data))))).map(b => b.toString(16).padStart(2, "0")).join("");

export async function verifyTurnstile(token, env) {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }),
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Turnstile unavailable");
  const result = await response.json();
  // Offisiell testnøkkel gir example.com og ingen action. Tillat dette bare
  // når samtlige tillatte nettsider er våre to lokale utviklingsoriginer.
  const origins = list(env.ALLOWED_ORIGINS);
  if (env.TURNSTILE_SECRET_KEY === "1x0000000000000000000000000000000AA") {
    return origins.length > 0 && origins.every(o => ["http://localhost:8000", "http://127.0.0.1:8000"].includes(o))
      && result.success === true && result.hostname === "example.com";
  }
  return result.success === true && result.action === "send-sak" && list(env.TURNSTILE_HOSTNAMES).includes(result.hostname);
}

async function submit(req, env, services) {
  // API-/admintilgang åpner ikke mottak: innsending har en egen, eksplisitt originliste.
  if (env.SUBMISSIONS_OPEN !== "true" || !list(env.SUBMISSION_ORIGINS).includes(req.headers.get("origin")) || !env.TURNSTILE_SECRET_KEY || !env.TURNSTILE_HOSTNAMES) fail(503, "Innsending er ikke åpnet ennå. Prøv igjen senere.");
  const ip = req.headers.get("cf-connecting-ip");
  if (!ip || !env.SUBMISSION_LIMITER) fail(503, "Innsending er midlertidig utilgjengelig.");
  const { success } = await env.SUBMISSION_LIMITER.limit({ key: ip });
  if (!success) fail(429, "Du har sendt flere meldinger på kort tid. Vent ett minutt og prøv igjen.");
  const d = await body(req);
  if (!UUID.test(d.id || "")) fail(400, "Ugyldig innsending-ID.");
  if (text(d["bot-felt"], 200)) fail(400, "Innsendingen ble avvist.");
  const fields = {
    tema: text(d.tema, 200), melding: text(d.melding, 2000, 3),
    navn: text(d.navn, 200), epost: text(d.epost, 254), trinn: text(d.trinn, 100)
  };
  if (fields.epost && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.epost)) fail(400, "Kontroller e-postadressen.");
  const token = text(d.turnstileToken, 2048, 1);
  if (!await services.verifyTurnstile(token, env)) fail(400, "Botsjekken må gjøres på nytt. Prøv igjen.");
  const hash = await fingerprint(fields);
  await env.DB.prepare(`INSERT INTO saker (id, fingerprint, mottatt, tema, melding, navn, epost, trinn)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`)
    .bind(d.id, hash, new Date().toISOString(), ...Object.values(fields)).run();
  const saved = await env.DB.prepare("SELECT fingerprint FROM saker WHERE id = ?").bind(d.id).first();
  if (!saved || saved.fingerprint !== hash) fail(409, "Innsendingen er endret. Start en ny innsending.");
  return json({ mottatt: true }, 201);
}

async function getCases(db, id) {
  const cases = await (id ? db.prepare("SELECT * FROM saker WHERE id = ?").bind(id) : db.prepare("SELECT * FROM saker ORDER BY mottatt DESC")).all();
  const events = await (id ? db.prepare("SELECT * FROM hendelser WHERE sak_id = ? ORDER BY nr").bind(id) : db.prepare("SELECT * FROM hendelser ORDER BY nr")).all();
  const byId = new Map(cases.results.map(({ fingerprint: _private, arkivert: _archive, ...s }) => [s.id, { ...s, svar: [], notater: [], logg: [] }]));
  for (const e of events.results) {
    const s = byId.get(e.sak_id);
    if (!s) continue;
    const event = { tid: e.tid, hvem: e.hvem, epost: e.epost };
    if (e.type === "logg") s.logg.push({ ...event, hva: e.tekst });
    else s[e.type === "svar" ? "svar" : "notater"].push({ ...event, tekst: e.tekst });
  }
  return [...byId.values()];
}

async function admin(req, env, services) {
  const user = await services.authenticate(req, env);
  if (!user || !addresses(env.ADMIN_EPOSTER).includes(user.epost)) fail(401, "Logg inn med en Google-konto som har FAU-tilgang.");
  if (req.method === "GET") return json({ bruker: user, saker: await getCases(env.DB), admins: addresses(env.ADMIN_EPOSTER) });
  if (!["POST", "DELETE"].includes(req.method)) fail(405, "Metoden støttes ikke.");
  const d = await body(req);
  if (!UUID.test(d.id || "")) fail(400, "Ugyldig sak-ID.");
  if (req.method === "DELETE") {
    await env.DB.prepare("DELETE FROM saker WHERE id = ?").bind(d.id).run();
    return json({ slettet: d.id });
  }
  if (!await env.DB.prepare("SELECT id FROM saker WHERE id = ?").bind(d.id).first()) fail(404, "Fant ikke saken.");
  const now = new Date().toISOString();
  const sets = [], values = [], changes = [], events = [];
  const set = (column, value) => { sets.push(`${column} = ?`); values.push(value); };
  if (d.status !== undefined) {
    if (!STATUSES.includes(d.status)) fail(400, "Ugyldig status.");
    // Behold dato ved gjentatt arkivering; gjenåpning fjerner den.
    sets.push("arkivert = CASE WHEN ? = 'arkivert' THEN COALESCE(arkivert, ?) ELSE NULL END");
    values.push(d.status, now); set("status", d.status); changes.push("status: " + d.status);
  }
  if (d.ansvarlig !== undefined) {
    const owner = text(d.ansvarlig, 254).toLowerCase();
    if (owner && !addresses(env.ADMIN_EPOSTER).includes(owner)) fail(400, "Ugyldig ansvarlig.");
    set("ansvarlig", owner); changes.push("ansvarlig: " + (owner || "ingen"));
  }
  for (const [field, type, max] of [["svar", "svar", 10000], ["notatNy", "notat", 5000]]) {
    if (d[field] === undefined) continue;
    const value = text(d[field], max, 1);
    events.push({ type, value }); changes.push(type === "svar" ? "svarte" : "internt notat");
  }
  if (events.some(e => e.type === "svar")) {
    // SQL bruker siste status, ikke en eldre kopi lest fra databasen.
    // Et eksplisitt statusvalg i samme kall har forrang.
    if (d.status === undefined) sets.push("status = CASE WHEN status = 'arkivert' THEN status ELSE 'besvart' END");
  }
  if (!changes.length) fail(400, "Ingen endringer.");
  const statements = [];
  if (sets.length) statements.push(env.DB.prepare(`UPDATE saker SET ${sets.join(", ")} WHERE id = ?`).bind(...values, d.id));
  events.push({ type: "logg", value: changes.join(", ") });
  for (const event of events) statements.push(env.DB.prepare(`INSERT INTO hendelser (sak_id, type, tid, hvem, epost, tekst)
    SELECT id, ?, ?, ?, ?, ? FROM saker WHERE id = ?`).bind(event.type, now, user.navn, user.epost, event.value, d.id));
  // D1 batch er én transaksjon: tekst og logg lagres samlet, uten read/modify/write av hele saken.
  await env.DB.batch(statements);
  const [sak] = await getCases(env.DB, d.id);
  if (!sak) fail(404, "Fant ikke saken.");
  return json({ sak });
}

export async function handleRequest(req, env, services = { authenticate, verifyTurnstile }) {
  const origin = req.headers.get("origin");
  let response;
  try {
    if (!origin || !list(env.ALLOWED_ORIGINS).includes(origin)) fail(403, "Nettstedet har ikke tilgang.");
    if (req.method === "OPTIONS") {
      if (!["GET", "POST", "DELETE"].includes(req.headers.get("access-control-request-method"))) fail(405, "Metoden støttes ikke.");
      response = new Response(null, { status: 204 });
    } else {
      const path = new URL(req.url).pathname;
      if (path === "/api/saker") {
        if (req.method !== "POST") fail(405, "Metoden støttes ikke.");
        response = await submit(req, env, services);
      } else if (path === "/api/admin/konfig" && req.method === "GET") {
        response = json({ klientId: env.GOOGLE_CLIENT_ID || null });
      } else if (path === "/api/admin") response = await admin(req, env, services);
      else fail(404, "Fant ikke endepunktet.");
    }
  } catch (error) {
    // Ikke logg unntaket: det kan inneholde SQL-parametre eller innhold fra tredjepart.
    response = json({ feil: error instanceof HttpError ? error.message : "Tjenesten er midlertidig utilgjengelig. Prøv igjen." }, error instanceof HttpError ? error.status : 503);
  }
  response.headers.set("cache-control", "no-store");
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("vary", "Origin");
  if (response.status === 429) response.headers.set("retry-after", "60");
  if (origin && list(env.ALLOWED_ORIGINS).includes(origin)) {
    response.headers.set("access-control-allow-origin", origin);
    response.headers.set("access-control-allow-methods", "GET, POST, DELETE, OPTIONS");
    response.headers.set("access-control-allow-headers", "Authorization, Content-Type");
    response.headers.set("access-control-expose-headers", "Retry-After");
  }
  return response;
}

export function archiveCutoff(now = new Date()) {
  // Kalendermåneder med klamping for 29. februar.
  const year = now.getUTCFullYear() - 1, month = now.getUTCMonth();
  const day = Math.min(now.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate());
  return new Date(Date.UTC(year, month, day, now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(), now.getUTCMilliseconds())).toISOString();
}
export async function purgeArchived(env, now) {
  return env.DB.prepare("DELETE FROM saker WHERE status = 'arkivert' AND arkivert <= ?").bind(archiveCutoff(now)).run();
}
export default {
  fetch(req, env) { return handleRequest(req, env); },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(purgeArchived(env, new Date(event.scheduledTime)).catch(() => { console.error("Automatisk sletting feilet; kontroller databasetilgang."); }));
  }
};
