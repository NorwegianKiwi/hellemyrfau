# Hellemyr FAU

Kildekode for [hellemyrfau.no](https://hellemyrfau.no) og `/admin`.
Statisk HTML, CSS og JavaScript publiseres fra `hellemyrfau/nettside` til GitHub Pages.
Én Cloudflare Worker håndterer skjema og admin, med én privat D1-database i EU.

## Utvikling

Bruk Node.js 24 og npm:

```sh
npm ci
npm test
npm run build
npm run check:worker
python3 -m http.server 8000 --directory dist
```

Åpne `http://localhost:8000`. Vanlig bygg har innsending og admin deaktivert,
og viser aldri en falsk bekreftelse på at en melding er sendt.

For lokal skjema- og databaseutvikling:

```sh
npm run db:local
npm run build:local
npm run dev:api
```

La API-et kjøre i én terminal og Python-serveren i en annen. Bruk localhost:8000
eller 127.0.0.1:8000. Lokal Worker bruker egen lokal D1 og Turnstile-testnøkler;
det finnes ingen bryter som hopper over Google-verifisering. Lokal admin krever en
Google OAuth-klient som tillater localhost:8000, og godkjent administratoradresse.
Kopier `.dev.vars.example` til `.dev.vars.local` og fyll inn disse to verdiene.
Ikke kjør `wrangler dev --remote` eller pek lokale bygg mot produksjonsdatabasen.

## Innhold

- `fau-nettside/`: offentlig nettside, dokumenter og skrifttyper.
- `fau-admin/admin/`: admininnboks; samme innlogging og e-postflyt som før.
- `shared/`: nettlesermoduler for API og botsjekk.
- `worker/`: API, Google-verifisering, databasemigrering og automatisk sletting.
- `scripts/build.mjs`: samler offentlige filer i `dist/`.

Bygget publiserer ikke serverkode eller hemmeligheter. `dist/`, `build/`,
`.wrangler/`, `.dev.vars*`, private eksporter og lokale tilganger holdes utenfor Git.
Innsendte saker skal aldri legges i repo, PR-er, issues, logger eller skjermbilder.

## Publisering og drift

Se [DRIFT.md](DRIFT.md) for kontoer, EU-database, Google, Turnstile,
GitHub Pages, lansering, sikkerhetskopi og overlevering.

Nettsiden publiseres fra `main` etter tester når de offentlige GitHub-variablene
er satt. Før det kjøres bare kontroller. Worker og migreringer publiseres manuelt
fra gjennomgått kode. Ingen Cloudflare-token lagres i GitHub Actions.

E-post fra admin åpnes i administratorens e-postprogram. Det sendes ikke automatisk.
Mottak av saker via e-post inngår ikke i denne versjonen.

## Samarbeid og lisens

Bruk grener og pull requests; se [CONTRIBUTING.md](CONTRIBUTING.md).
En åpen kildekodelisens er foreløpig ikke valgt. At repoet er offentlig betyr
ikke at kode, dokumenter, bilder og skrifttyper automatisk har en fri lisens.
