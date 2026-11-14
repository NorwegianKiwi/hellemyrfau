# FAU på Hellemyr skole – innboks (admin)

Innboksen på https://hellemyrfau.no/admin, der FAU leser og svarer på saker fra «Meld inn sak».

## Slik virker det

- `netlify-funksjoner/fn/submission-created.mjs` behandler skjemaet `send-inn-sak` og lagrer saken i Netlify Blobs, i lageret `saker`.
- `netlify-funksjoner/fn/admin-api.mjs` håndterer saker, svar, notater, status, ansvarlig og sletting via `/api/admin`.
- `netlify-funksjoner/felles.mjs` inneholder lagring og kontroll av Google-innlogging.
- `admin/index.html` er selve innboksen.

Google-innlogging kontrolleres på serveren. `GOOGLE_CLIENT_ID` og `ADMIN_EPOSTER`
settes i Netlify for produksjon; faktiske verdier skal ikke inn i repoet.

## Bygge

Alle avhengigheter installeres og funksjonene bygges fra **repoets rotmappe**:

```sh
npm ci
npm run build
```

Vanlige bygg deaktiverer admin og lagring. `npm run build:production` bygger de
opprinnelige funksjonene til `build/functions/` uten å publisere. På Netlify velges
produksjonsfunksjonene automatisk ved `CONTEXT=production`.

Se [felles README](../README.md) for kontroll, forhåndsvisninger og publisering.
Ikke kopier adminfiler manuelt inn i `fau-nettside/`; byggeskriptet samler dem i `dist/`.
