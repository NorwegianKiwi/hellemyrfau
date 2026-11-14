# Hellemyr FAU

Kildekode for [hellemyrfau.no](https://hellemyrfau.no) og
[admininnboksen](https://hellemyrfau.no/admin). Begge delene publiseres sammen
til ett Netlify-prosjekt.

## Innhold

- `fau-nettside/`: offentlig nettside, dokumenter og skrifttyper.
- `fau-admin/admin/`: brukergrensesnitt for admininnboksen.
- `fau-admin/netlify-funksjoner/`: serverfunksjoner for innlogging og behandling av saker.

Nettsidene bruker HTML, CSS og JavaScript uten et frontend-rammeverk.
Adminfunksjonene bruker Node.js og `@netlify/blobs`.

## Kode og meldinger er separate

Dette repoet inneholder kildekode og offentlige nettsidefiler. Innsendte saker,
svar og interne notater lagres i Netlify Blobs, i lageret `saker`, og skal ikke
legges i GitHub. Skjemainnsendinger håndteres av Netlify Forms.

Admin-API-et kontrollerer Google-innlogging og tillatte e-postadresser på serveren.
Tilgang til GitHub gir ikke i seg selv tilgang til admininnboksen eller Netlify.

Følgende miljøvariabler settes i Netlify, uten faktiske verdier i repoet:

- `GOOGLE_CLIENT_ID`: klient-ID for Google-innlogging.
- `ADMIN_EPOSTER`: kommaseparert liste over e-postadresser med admintilgang.

Private sikkerhetskopier og dataeksporter må oppbevares separat fra repoet.
`.gitignore` er et hjelpemiddel; kontroller alltid filene før en commit.

## Se nettsiden lokalt

Kjør fra rotmappen med Python 3:

```sh
python3 -m http.server 8000 --directory fau-nettside
```

Åpne <http://localhost:8000>. Dette viser den offentlige nettsiden. Netlify Forms,
serverfunksjoner og admininnlogging fungerer ikke med denne enkle lokale serveren.
Innsending av skjema er deaktivert på localhost i nettsidekoden.

## Bygg og kontroll

Bruk Node.js 24 (se `.nvmrc`) og npm. Kjør fra rotmappen:

```sh
npm ci
npm test
npm run build
```

`dist/` inneholder bare nettsidefiler og `admin/`. `build/functions/` inneholder
serverfunksjonene. Begge mappene genereres på nytt og holdes utenfor Git.
Netlify-oppsettet og alle npm-avhengigheter ligger i rotmappen. Offentlige
rotfiler listes eksplisitt i `scripts/build.mjs`; legg nye filer til der ved behov.
Filer i `dokumenter/`, `fonts/` og adminmappen kopieres samlet og må være offentlige.

Lokale bygg, Deploy Previews og branch deploys har admin og Blobs-lagring
**deaktivert**. API-et svarer med 503, og innlogging er utilgjengelig. Dette er
bevisst; forhåndsvisningene er til visuell kontroll. Skjemaet på nettsiden er
fortsatt til stede og kan tas imot av Netlify Forms, så ikke send testmeldinger der.

Netlify bygger de ekte funksjonene når `CONTEXT=production`. For å kontrollere
produksjonsbygget lokalt uten å publisere:

```sh
npm run build:production
```

Dette bygger kode, men kobler seg ikke til Netlify eller henter saker. Et eksplisitt
produksjonsbygg avvises hvis `CONTEXT` er satt til noe annet enn `production`.
Kjør `npm run build` igjen før lokal visning hvis du vil ha forhåndsvisningsbygget.

GitHub Actions kjører `npm ci`, testene og et forhåndsvisningsbygg på pull requests
og endringer på `main`, uten produksjonshemmeligheter.

## Koble eksisterende Netlify-prosjekt til GitHub

Nettstedet driftes foreløpig i Brors eksisterende Netlify-prosjekt. Denne endringen
kobler ikke prosjektet til GitHub og endrer ikke domene eller lagrede saker.

Bror utfører koblingen etter at pull requesten er gjennomgått og merget:

1. Ta en privat sikkerhetskopi av sakene og noter dagens fungerende deploy.
2. I **det eksisterende prosjektet**, kontroller tilgang og innstillinger før
   repoet kobles til. Bruk `NorwegianKiwi/hellemyrfau`, produksjonsgren `main`,
   rotmappen som base, byggekommando `npm run build` og publiseringsmappe `dist`.
   Tøm eventuell gammel Package directory. `netlify.toml` angir funksjonsmappen
   `build/functions` og bevarer eksisterende HTTP-headere.
3. Behold `GOOGLE_CLIENT_ID` og `ADMIN_EPOSTER` for produksjonsfunksjonene. Begrens
   disse til produksjon i Netlify. Ikke legg dem i GitHub. Kontroller at Google
   OAuth-prosjektet fortsatt tillater `https://hellemyrfau.no`.
4. Deaktiver automatiske bygg av eksterne pull requests før repoet kobles til,
   eller krev godkjenning og kontroller hele endringen før et slikt bygg kjøres.
   Byggeskriptet gir funksjonell isolering for vanlig kode, men ondsinnet kode kan
   endre skriptet og bruke prosjektets automatiske tilgang til Netlify Blobs.
   Bruk et separat testprosjekt uten produksjonsdata for eksterne bidrag hvis dere
   ønsker automatiske forhåndsvisninger. GitHub Actions kan fortsatt kontrollere PR-er.
5. Koble repoet til prosjektet og kontroller første produksjonsbygg. Sjekk nettsiden,
   dokumentlenker og `/admin`, samt at API-et avviser uinnloggede og at en godkjent
   administrator ser eksisterende saker. Avtal én tydelig merket testsak for å
   kontrollere hele skjema-/innboksflyten; rydd den etterpå.
6. Hvis publiseringen feiler, gjenopprett forrige fungerende deploy i Netlify og
   undersøk feilen før ny publisering. GitHub-repoet og sakene skal ikke slettes.

Behold samme Netlify-prosjekt under koblingen. Flytting til et FAU-team og eventuell
endring av lagring håndteres separat. Ikke opprett et nytt produksjonsprosjekt
som erstatning uten en egen plan for data og innstillinger.

## Samarbeid

Bruk egne grener og pull requests mot `main`. Andre kan foreslå endringer via
fork og pull request. Se [CONTRIBUTING.md](CONTRIBUTING.md).

## Lisens

En åpen kildekodelisens er foreløpig ikke valgt. At repoet er offentlig betyr
ikke at kode, dokumenter, bilder og skrifttyper automatisk har en fri lisens.
Avklar rettigheter og lisens med bidragsyterne før en lisens legges til.
