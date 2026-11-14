import { butikk, hvemErInnlogget, json } from "../felles.mjs";

const STATUSER = ["ny", "under behandling", "besvart", "arkivert"];

export default async (req) => {
  const url = new URL(req.url);
  if (url.pathname.endsWith("/konfig")) return json({ klientId: process.env.GOOGLE_CLIENT_ID || null });

  const bruker = await hvemErInnlogget(req);
  if (!bruker) return json({ feil: "Ikke innlogget, eller e-posten har ikke tilgang." }, 401);
  const lager = butikk();

  if (req.method === "GET") {
    const { blobs } = await lager.list();
    const saker = (await Promise.all(blobs.map(b => lager.get(b.key, { type: "json" })))).filter(Boolean);
    saker.sort((a, b) => b.mottatt.localeCompare(a.mottatt));
    const admins = (process.env.ADMIN_EPOSTER || "").split(",").map(e => e.trim()).filter(Boolean);
    return json({ bruker, saker, admins });
  }

  if (req.method === "POST") {
    const { id, status, notat, ansvarlig, svar, notatNy } = await req.json();
    const sak = id && await lager.get(id, { type: "json" });
    if (!sak) return json({ feil: "Fant ikke saken." }, 404);
    const endret = [];
    if (status !== undefined && STATUSER.includes(status) && status !== sak.status) { sak.status = status; endret.push("status: " + status); }
    if (notat !== undefined && notat !== sak.notat) { sak.notat = String(notat).slice(0, 5000); endret.push("notat"); }
    if (ansvarlig !== undefined && ansvarlig !== (sak.ansvarlig || "")) { sak.ansvarlig = String(ansvarlig).slice(0, 200); endret.push("ansvarlig: " + (sak.ansvarlig || "ingen")); }
    if (svar && String(svar).trim()) {
      sak.svar = sak.svar || [];
      sak.svar.push({ tid: new Date().toISOString(), hvem: bruker.navn, epost: bruker.epost, tekst: String(svar).trim().slice(0, 10000) });
      if (sak.status !== "arkivert") sak.status = "besvart";
      endret.push("svarte");
    }
    if (notatNy && String(notatNy).trim()) {
      sak.notater = sak.notater || [];
      sak.notater.push({ tid: new Date().toISOString(), hvem: bruker.navn, tekst: String(notatNy).trim().slice(0, 5000) });
      endret.push("internt notat");
    }
    if (endret.length) {
      sak.logg.push({ tid: new Date().toISOString(), hvem: bruker.navn, hva: endret.join(", ") });
      await lager.setJSON(id, sak);
    }
    return json({ sak });
  }

  if (req.method === "DELETE") {
    const { id } = await req.json();
    if (!id) return json({ feil: "Mangler id." }, 400);
    await lager.delete(id);
    return json({ slettet: id });
  }

  return json({ feil: "Ikke støttet." }, 405);
};

export const config = { path: ["/api/admin", "/api/admin/konfig"] };
