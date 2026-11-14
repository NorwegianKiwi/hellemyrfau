# FAU på Hellemyr skole – nettside

Kildekoden til https://hellemyrfau.no. Statisk nettside (én side med hash-ruter i `index.html`) som publiseres på Netlify.

## Innhold
- `index.html` – hele nettsiden: innhold (PAGES), stil og skript
- `qr-ukeplan.html`, `404.html`, `takk.html` – egne sider
- `dokumenter/` – PDF-er til nedlasting
- `fonts/` – Sofia Sans (selvhostet)
- `_redirects`, `robots.txt`, `sitemap.xml` – omdirigeringer og søkemotorfiler; felles `netlify.toml` ligger i repoets rotmappe
- `og-bilde.png`, `favicon.*`, `apple-touch-icon.png`, `hellemyr-ikon.svg` – bilder og ikon
- `moter.ics` – kalenderfil med FAU-møtene

Innboksen for FAU (hellemyrfau.no/admin) ligger i nabomappa `fau-admin` i samme repo.

## Bygge og publisere

Kjør fra repoets rotmappe:

```sh
npm ci
npm run build
```

Bygget samler nettsiden og admin i `dist/`, og funksjonene i `build/functions/`.
Det er ikke lenger nødvendig å kopiere adminfiler manuelt. Vanlige lokale bygg
har admin og lagring deaktivert. Se [felles README](../README.md) for
produksjonsbygg og kobling til det eksisterende Netlify-prosjektet.
