import { butikk } from "../felles.mjs";

export default async (req) => {
  const { payload } = await req.json().catch(() => ({}));
  if (!payload || payload.form_name !== "send-inn-sak") return new Response("ok");
  const d = payload.data || {};
  if (d["bot-felt"]) return new Response("ok");
  const sak = {
    id: payload.id,
    mottatt: payload.created_at || new Date().toISOString(),
    tema: d.tema || "", melding: d.melding || "", navn: d.navn || "", epost: d.epost || "", trinn: d.trinn || "",
    status: "ny", notat: "", logg: []
  };
  try { await butikk().setJSON(sak.id, sak); }
  catch (e) { console.error("Lagring feilet", e); return new Response("feil", { status: 500 }); }
  return new Response("ok");
};
