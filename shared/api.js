import config from "./config.js";

export const enabled = config.enabled && config.allowedSiteOrigins.includes(location.origin);
export const turnstileSiteKey = config.turnstileSiteKey;
export async function request(path, { method = "GET", token, data } = {}) {
  if (!enabled) throw new Error("Innsending og admin er deaktivert i denne forhåndsvisningen.");
  let response;
  try { response = await fetch(config.apiBase + path, {
    method, credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(20000),
    headers: { ...(token ? { authorization: "Bearer " + token } : {}), ...(data ? { "content-type": "application/json" } : {}) },
    body: data ? JSON.stringify(data) : undefined
  }); } catch {
    throw new Error("Kunne ikke kontakte tjenesten. Prøv igjen. Utkastet er beholdt.");
  }
  const result = await response.json().catch(() => {
    throw new Error("Fikk ikke et gyldig svar fra tjenesten. Prøv igjen.");
  });
  if (!response.ok) {
    const error = new Error(result.feil || "Tjenesten er midlertidig utilgjengelig. Prøv igjen.");
    error.status = response.status;
    error.retryAfter = Number(response.headers.get("retry-after")) || 0;
    throw error;
  }
  return result;
}

// Bare ID og innholdsfingeravtrykk lagres her, ikke navn/e-post eller selve meldingen.
let attempt;
export async function submissionId(fields) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(fields))))).map(b => b.toString(16).padStart(2, "0")).join("");
  if (!attempt) { try { attempt = JSON.parse(sessionStorage.getItem("fau-innsending")); } catch {} }
  if (!attempt || attempt.hash !== hash) attempt = { hash, id: crypto.randomUUID() };
  try { sessionStorage.setItem("fau-innsending", JSON.stringify(attempt)); } catch {}
  return attempt.id;
}
export function clearSubmission() {
  attempt = null;
  try { sessionStorage.removeItem("fau-innsending"); } catch {}
}
