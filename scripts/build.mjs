import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const production = process.argv.includes("--production");
const local = process.argv.includes("--local");
if (local && production) throw new Error("Velg lokalt bygg eller produksjonsbygg.");
const basePath = production || local ? "/" : process.env.PUBLIC_BASE_PATH || "/";
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath)) throw new Error("PUBLIC_BASE_PATH må være en absolutt katalogsti med avsluttende skråstrek.");
const apiBase = production ? process.env.PUBLIC_API_BASE : local ? "http://localhost:8787" : "";
const turnstileSiteKey = production ? process.env.PUBLIC_TURNSTILE_SITE_KEY : local ? "1x00000000000000000000AA" : "";
if (production) {
  if (!apiBase || !turnstileSiteKey) throw new Error("Sett PUBLIC_API_BASE og PUBLIC_TURNSTILE_SITE_KEY før produksjonsbygg.");
  const url = new URL(apiBase);
  if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new Error("PUBLIC_API_BASE må være en HTTPS-origin uten sti eller tilgangsopplysninger.");
  }
  if (turnstileSiteKey.startsWith("1x000000") || turnstileSiteKey.startsWith("2x000000") || turnstileSiteKey.startsWith("3x000000")) {
    throw new Error("Turnstile-testnøkler er ikke tillatt i produksjon.");
  }
}
const site = resolve(root, "dist");
const publicFiles = [
  "index.html", "404.html", "takk.html", "qr-ukeplan.html", "robots.txt", "sitemap.xml", "moter.ics",
  "dokumenter", "fonts", "favicon.ico", "favicon.svg", "apple-touch-icon.png", "og-bilde.png", "hellemyr-ikon.svg"
];
await rm(site, { recursive: true, force: true });
await mkdir(site, { recursive: true });
for (const name of publicFiles) await cp(resolve(root, "fau-nettside", name), resolve(site, name), { recursive: true });
await cp(resolve(root, "fau-admin/admin"), resolve(site, "admin"), { recursive: true });
await cp(resolve(root, "shared"), resolve(site, "assets"), { recursive: true });
if (basePath !== "/") {
  // Bare nettstedsressurser skrives om; API-stier og hash-ruter beholdes.
  for (const name of [...publicFiles.filter(name => name.endsWith(".html")), "admin/index.html"]) {
    const path = resolve(site, name);
    const html = (await readFile(path, "utf8"))
      .replace(/(["'(])\/(?=(?:assets|fonts|dokumenter)\/|(?:favicon\.(?:ico|svg)|apple-touch-icon\.png|hellemyr-ikon\.svg|moter\.ics|og-bilde\.png)\b)/g, `$1${basePath}`)
      .replace(/(href=["'])\/(?=["'#])/g, `$1${basePath}`)
      .replace("</head>", '<meta name="robots" content="noindex, nofollow">\n</head>');
    await writeFile(path, html);
  }
  await writeFile(resolve(site, "robots.txt"), "User-agent: *\nDisallow: /\n");
}
await writeFile(resolve(site, "assets/config.js"), `export default ${JSON.stringify({
  apiBase: apiBase ? new URL(apiBase).origin : "", turnstileSiteKey, enabled: production || local,
  allowedSiteOrigins: production ? ["https://hellemyrfau.no", "https://www.hellemyrfau.no"] : local ? ["http://localhost:8000", "http://127.0.0.1:8000"] : []
})};\n`);
await writeFile(resolve(site, ".nojekyll"), "");
if (production) await writeFile(resolve(site, "CNAME"), "hellemyrfau.no\n");
console.log(`Bygget dist/ (${production ? "produksjon" : local ? "lokal API" : "innsending og admin deaktivert"}).`);
