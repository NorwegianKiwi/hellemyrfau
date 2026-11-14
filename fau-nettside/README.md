# FAU på Hellemyr skole – nettside

Kildekoden til https://hellemyrfau.no. Statisk nettside (én side med hash-ruter i `index.html`) som publiseres på Netlify.

## Innhold
- `index.html` – hele nettsiden: innhold (PAGES), stil og skript
- `qr-ukeplan.html`, `404.html`, `takk.html` – egne sider
- `dokumenter/` – PDF-er til nedlasting
- `fonts/` – Sofia Sans (selvhostet)
- `netlify.toml`, `_redirects`, `robots.txt`, `sitemap.xml` – Netlify-oppsett
- `og-bilde.png`, `favicon.*`, `apple-touch-icon.png`, `hellemyr-ikon.svg` – bilder og ikon
- `moter.ics` – kalenderfil med FAU-møtene

Innboksen for FAU (hellemyrfau.no/admin) ligger i nabomappa `fau-admin` i samme repo.

## Publisere
```
netlify deploy --prod --dir . --functions ../fau-admin/netlify-funksjoner/bygg
```
Kopier `fau-admin/admin/` inn som `admin/` i denne mappa før publisering, ellers forsvinner innboksen.
