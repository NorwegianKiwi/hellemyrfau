# FAU på Hellemyr skole – innboks (admin)

Innboksen på https://hellemyrfau.no/admin, der FAU leser og svarer på saker fra «Meld inn sak».

## Slik virker det
- `netlify-funksjoner/fn/submission-created.mjs` – kjører når skjemaet «send-inn-sak» sendes inn, og lagrer saken i Netlify Blobs (butikken `saker`).
- `netlify-funksjoner/fn/admin-api.mjs` – API for innboksen (`/api/admin`): hente saker, svare, interne notater, status, ansvarlig og sletting.
- `netlify-funksjoner/felles.mjs` – felles kode: lagring og sjekk av Google-innlogging.
- `admin/index.html` – selve innboksen (Meldinger-lignende visning).

## Innlogging
Google-innlogging. Bare e-postadressene i miljøvariabelen `ADMIN_EPOSTER` slipper inn.

Miljøvariabler som må settes i Netlify (ligger IKKE i koden):
- `GOOGLE_CLIENT_ID` – OAuth-klient-ID fra Google Cloud (prosjekt «FAU Hellemyr admin»)
- `ADMIN_EPOSTER` – kommaseparert liste med e-postadresser som har tilgang

## Bygge funksjonene
Netlifys egen bunting finner ikke `@netlify/blobs`, så funksjonene buntes på forhånd:
```
cd netlify-funksjoner
npm install
npx esbuild fn/admin-api.mjs fn/submission-created.mjs --bundle --platform=node --target=node20 --format=esm --outdir=bygg --out-extension:.js=.mjs --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"
```
