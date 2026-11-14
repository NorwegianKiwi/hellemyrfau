# Hellemyr FAU

Kildekode for [hellemyrfau.no](https://hellemyrfau.no) og
[admininnboksen](https://hellemyrfau.no/admin). Begge delene publiseres sammen
til ett Netlify-prosjekt.

## Innhold

- `fau-nettside/`: offentlig nettside, dokumenter, skrifttyper og Netlify-oppsett.
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

## Publisering

Nettstedet driftes foreløpig i Brors eksisterende Netlify-prosjekt. Opprettelse
av dette repoet endrer ikke publisering, domene, miljøvariabler eller lagrede saker.
Automatisk publisering fra GitHub er ikke satt opp som del av klargjøringen.

Dagens manuelle fremgangsmåte er beskrevet i
[nettsidens README](fau-nettside/README.md) og
[adminsin README](fau-admin/README.md). Funksjonene må bygges og adminfilene
kopieres inn før publisering, slik at begge deler blir med. Avtal publisering
med den som administrerer det eksisterende Netlify-prosjektet.

Før GitHub kobles til Netlify må vi automatisere denne samlede byggingen og
kontrollere at nettside, skjema og admin fungerer. Behold det eksisterende
Netlify-prosjektet under denne koblingen for å beholde tilknytningen til dataene.

**Forhåndsvisninger må ikke få tilgang til ekte saker.** Koden bruker `getStore`,
som åpner et lager delt mellom deployer i samme Netlify-prosjekt. Isoler testdata
eller deaktiver adminfunksjonene i forhåndsvisninger før slike bygg aktiveres.
Kode fra eksterne pull requests skal ikke kjøres med produksjonstilgang.

## Samarbeid

Bruk egne grener og pull requests mot `main`. Andre kan foreslå endringer via
fork og pull request. Se [CONTRIBUTING.md](CONTRIBUTING.md).

## Lisens

En åpen kildekodelisens er foreløpig ikke valgt. At repoet er offentlig betyr
ikke at kode, dokumenter, bilder og skrifttyper automatisk har en fri lisens.
Avklar rettigheter og lisens med bidragsyterne før en lisens legges til.
