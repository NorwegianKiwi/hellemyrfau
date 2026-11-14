import { getStore } from "@netlify/blobs";

export const butikk = () => getStore({ name: "saker", consistency: "strong" });

const norm = e => {
  e = String(e || "").trim().toLowerCase();
  const [lokal, domene] = e.split("@");
  if (domene === "gmail.com" || domene === "googlemail.com") return lokal.split("+")[0].replace(/\./g, "") + "@gmail.com";
  return e;
};

export async function hvemErInnlogget(req) {
  const klientId = process.env.GOOGLE_CLIENT_ID;
  const tillatt = (process.env.ADMIN_EPOSTER || "").split(",").map(norm).filter(Boolean);
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!klientId || !token || !tillatt.length) return null;
  const svar = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token));
  if (!svar.ok) return null;
  const info = await svar.json();
  const gyldig = info.aud === klientId
    && ["accounts.google.com", "https://accounts.google.com"].includes(info.iss)
    && String(info.email_verified) === "true"
    && Number(info.exp) * 1000 > Date.now();
  if (!gyldig || !tillatt.includes(norm(info.email))) return null;
  return { epost: info.email, navn: info.name || info.email };
}

export const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
});
