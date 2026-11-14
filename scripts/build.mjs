import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const context = process.env.CONTEXT;
const explicitProduction = process.argv.includes("--production");
if (explicitProduction && context && context !== "production") {
  throw new Error("Produksjonsbygg er ikke tillatt i konteksten " + context);
}
const production = context === "production" || explicitProduction;
const site = resolve(root, "dist");
const functions = resolve(root, "build/functions");

// Bare kjente offentlige filer kopieres, aldri README, miljøfiler eller kildekode.
const publicFiles = [
  "index.html", "404.html", "takk.html", "qr-ukeplan.html", "_redirects",
  "robots.txt", "sitemap.xml", "moter.ics", "dokumenter", "fonts",
  "favicon.ico", "favicon.svg", "apple-touch-icon.png", "og-bilde.png", "hellemyr-ikon.svg"
];

// Rydd bare de to kjente genererte mappene, også ved bytte av byggekontekst.
await rm(site, { recursive: true, force: true });
await rm(functions, { recursive: true, force: true });
await mkdir(site, { recursive: true });
await mkdir(functions, { recursive: true });
for (const name of publicFiles) {
  await cp(resolve(root, "fau-nettside", name), resolve(site, name), { recursive: true });
}
await cp(resolve(root, "fau-admin/admin"), resolve(site, "admin"), { recursive: true });

if (production) {
  await build({
    absWorkingDir: root,
    entryPoints: [
      "fau-admin/netlify-funksjoner/fn/admin-api.mjs",
      "fau-admin/netlify-funksjoner/fn/submission-created.mjs"
    ],
    outdir: functions,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    target: "node24",
    format: "esm",
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" }
  });
} else {
  // Ingen import av Blobs eller innlogging i funksjonene for forhåndsvisninger.
  const disabled = `export default async () => new Response(JSON.stringify({
    klientId: null, feil: "Admin og lagring er deaktivert i forhåndsvisninger."
  }), { status: 503, headers: {
    "content-type": "application/json; charset=utf-8", "cache-control": "no-store"
  }});\n`;
  await writeFile(resolve(functions, "admin-api.mjs"), disabled +
    'export const config = { path: ["/api/admin", "/api/admin/konfig"] };\n');
  await writeFile(resolve(functions, "submission-created.mjs"), disabled);
}

console.log(`Bygget ${production ? "produksjon" : "forhåndsvisning (admin og lagring deaktivert)"}: dist/ og build/functions/`);
