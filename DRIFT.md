# Oppsett og drift

## Førstegangsoppsett

Bruk Node.js 24 og `npm ci`. Kontooppsettet gjøres av FAU; ingen passord eller
hemmelige nøkler skal sendes i chat eller legges i GitHub.

1. Opprett en Cloudflare-konto for Hellemyr FAU. Inviter minst to driftsansvarlige
   med egne innlogginger og tofaktor. Avtal hvem som følger opp feil og sikkerhetskopi.
   Bruk Workers Free og ikke aktiver betalte tjenester.
2. Kjør `npx wrangler login`. Kontroller at riktig FAU-konto er valgt, særlig hvis
   du har flere kontoer. `account_id` i `wrangler.jsonc` peker eksplisitt til
   Hellemyr FAU. Ikke overstyr den med `CLOUDFLARE_ACCOUNT_ID` for en annen konto.
3. Databasen skal ha **EU-jurisdiksjon**, ikke bare et plasseringstips.
   Ved eventuell nyoppretting brukes:

   ```sh
   npx wrangler d1 create hellemyrfau-saker --jurisdiction=eu
   ```

   Produksjonsdatabasen er allerede opprettet og koblet til `DB` i
   `wrangler.jsonc`; ikke opprett en ny ved vanlig oppsett. Kommandoen over er
   referanse for eventuell nyoppretting. Konto- og database-ID er ikke hemmeligheter.
   Behold lokal database separat.
   Kontroller EU-jurisdiksjon i kontrollpanelet; den kan ikke endres etter opprettelse.
4. Opprett Google OAuth-klient av typen Web application i et Google-prosjekt FAU
   har tilgang til. Gi minst to driftsansvarlige tilgang der også. Tillat JavaScript-
   origin `https://hellemyrfau.no` og `https://www.hellemyrfau.no`. Bruk separat
   klient for lokal utvikling med `http://localhost:8000` og eventuelt 127.0.0.1.
   Konfigurer samtykkeskjerm/publiseringsstatus for administratorene som skal bruke den.
   Sett produksjonsklientens ID i `vars.GOOGLE_CLIENT_ID` i `wrangler.jsonc`.
5. Opprett én Turnstile-widget for hellemyrfau.no og www.hellemyrfau.no. Velg
   Managed. Domenets DNS trenger ikke ligge hos Cloudflare for dette.
   Nettstedsnøkkelen er offentlig; den hemmelige nøkkelen er bare for Worker-en.
6. Legg inn serverhemmeligheter via Wrangler; skriv verdiene i den skjulte prompten:

   ```sh
   npx wrangler secret put TURNSTILE_SECRET_KEY --env ""
   npx wrangler secret put ADMIN_EPOSTER --env ""
   ```

   `ADMIN_EPOSTER` er en kommaseparert liste med eksakte, bekreftede Google-
   e-postadresser i små bokstaver. Ikke bruk Gmail-aliasnormalisering som utvider
   listen. Kontrollpaneltilgang og tilgang til `/admin` er to separate tillatelser.
7. Kjør migrering og publiser med mottaket fortsatt stengt:

   ```sh
   npx wrangler d1 migrations apply DB --remote --env ""
   npm run check:worker
   npm run deploy:worker
   ```

   Kontroller kontonavn og databasenavn i Wrangler før du bekrefter en ekstern
   migrering. Noter Worker-ens faktiske HTTPS-adresse på `workers.dev`.
8. I GitHub-repoets Settings → Secrets and variables → Actions → Variables, sett:
   - `PUBLIC_API_BASE`: Worker-ens origin, f.eks. `https://hellemyrfau-api.kontonavn.workers.dev`, uten sti.
   - `PUBLIC_TURNSTILE_SITE_KEY`: Turnstile-nettstedsnøkkelen.

   Disse er offentlige variabler, ikke hemmeligheter. Cloudflare-token,
   Turnstile-hemmelighet og administratorliste skal ikke legges i GitHub.
9. Velg GitHub Actions som kilde under Settings → Pages. La Custom domain være
   tom under forhåndsvisningen. Uten `PAGES_PRODUCTION=true` bygges siden for
   `https://hellemyrfau.github.io/nettside/`, med riktige ressursstier, ingen CNAME,
   og innsending og admin deaktivert med mindre `PAGES_PREVIEW_API=true`. Forhåndsvisningen ber søkemotorer om ikke å
   indeksere siden; den er fortsatt offentlig tilgjengelig. Netlify og DNS endres
   ikke av Pages-publisering. Stans Netlifys automatiske publisering, eller suspender
   Netlify-appen i GitHub-organisasjonen, før flere endringer merges.
10. Start workflowen «Kontroller bygg» manuelt på main etter oppsettet, eller la
    neste gjennomgåtte endring på main utløse publisering. PR-er kjører kontroller,
    men publiseres ikke. Statisk forhåndsvisning trenger ikke API-nøklene. API-forhåndsvisning og
    produksjonsbygg stopper med feil hvis de offentlige API-variablene mangler.

## Funksjonstest på GitHub-forhåndsvisningen

Netlify betjener fortsatt det offentlige domenet. Behold Netlify-appen suspendert.
Ikke endre DNS, Pages Custom domain eller `PAGES_PRODUCTION` i denne prosedyren.
Gjennomgå og merge PR-en først; Worker publiseres manuelt fra gjennomgått kode.
Ingen Worker-publisering eller åpning av mottak skjer ved merge alene.

1. I Google Cloud Console, velg prosjektet **Hellemyr FAU** (`hellemyr-fau`).
   Åpne Google Auth Platform → Clients og den eksisterende webklienten med ID
   `357870358336-hcfhdi298sgebtmfnjs4g0uasu897357.apps.googleusercontent.com`.
   Legg til `https://hellemyrfau.github.io` under **Authorized JavaScript origins**
   og lagre. Behold de eksisterende originene. Ingen `/nettside/` eller `/admin/`
   i origin, ingen redirect URI: innloggingen bruker JavaScript-callback.
   Ingen Google client secret trengs eller skal hentes ut. Under Audience →
   Test users kan de to avtalte administratorene legges til ved behov mens appen
   har status External/Testing. Workerens eksakte e-postliste gjelder fortsatt.
2. I Cloudflare-kontoen **Hellemyr FAU**, åpne Turnstile og den eksisterende widgeten
   med site key `0x4AAAAAAGCd9rU6xcCb_d32`. Under **Hostname Management → Add Hostnames**
   legg til `hellemyrfau.github.io` og lagre. Bruk bare vertsnavnet, uten protokoll
   eller sti. Behold eksisterende verter, Managed-modus og pre-clearance avslått.
   Ikke roter eller vis den hemmelige nøkkelen.
3. Kontroller `wrangler.jsonc`: `ALLOWED_ORIGINS` inkluderer preview-origin;
   `TURNSTILE_HOSTNAMES` og `SUBMISSION_ORIGINS` tillater **bare preview-verten/origin**.
   `SUBMISSIONS_OPEN` står fortsatt til `false`. Publiser først med stengt mottak:

   ```sh
   npm run check:worker
   npm run deploy:worker
   ```

   Dette bruker eksisterende Worker, D1-binding og lagrede secrets. Ingen ny
   database, migrering eller secret er nødvendig. Origin-listen for API-tilgang
   åpner ikke innsending alene; POST krever også at origin finnes i
   `SUBMISSION_ORIGINS`, at `SUBMISSIONS_OPEN=true`, og gyldig Turnstile.
4. I GitHub Settings → Secrets and variables → Actions → Variables, sett
   `PAGES_PREVIEW_API=true`. Behold `PAGES_PRODUCTION` tom/false. De eksisterende
   `PUBLIC_API_BASE` og `PUBLIC_TURNSTILE_SITE_KEY` brukes. Start «Kontroller bygg»
   manuelt på main. API-bygget beholder `/nettside/`, noindex og ingen CNAME, og
   tillater bare `https://hellemyrfau.github.io` i nettlesermodulen.
   Åpne `https://hellemyrfau.github.io/nettside/admin/` og test Google-innlogging.
5. Når testerne er klare, åpne preview-mottaket eksplisitt fra gjennomgått kode:

   ```sh
   npx wrangler deploy --env "" --var SUBMISSIONS_OPEN:true
   ```

   Dette overstyrer bare av/på-bryteren i denne publiseringen. De endelige domenene
   avvises fortsatt av `SUBMISSION_ORIGINS`; Turnstile godtas bare fra preview-verten.
   Preview er offentlig tilgjengelig: alle med adressen kan sende testmeldinger
   når mottaket er åpent. CORS/Origin er ikke en privat testerinnlogging eller
   beskyttelse mot forfalskede HTTP-klienter. Bruk en kort testperiode og bare
   oppdiktede opplysninger, f.eks. melding med prefikset «TEST – SLETT».
6. Test anonym melding og oppdiktet kontaktinformasjon, admininnlogging,
   status/ansvarlig, svar, notat og sletting. Test også avvist innlogging og feil i
   botsjekk. Bekreft på mobil og stor skjerm. Svar lagres; e-post sendes ikke automatisk.
   Slett testsakene enkeltvis i admin etterpå, ikke slett hele databasen.
7. Steng testmottaket med `npm run deploy:worker` (repoets `SUBMISSIONS_OPEN=false`).
   Vanlig Worker-publisering stenger dermed et tidligere åpnet testmottak igjen.
   Sett eventuelt `PAGES_PREVIEW_API=false` og kjør Pages-workflowen for å deaktivere
   API-et i nettsiden også. Bare å deaktivere frontend stenger ikke Worker-mottaket.

### Hvor testmeldinger lagres

Preview bruker **samme** EU D1-database `hellemyrfau-saker`
(`aa3623ae-14fa-476d-b6aa-576b812b3b3f`), ikke en separat testdatabase.
Meldinger lagres i `saker`, svar/notater/historikk i `hendelser`. Begge avtalte
administratorer ser samme innboks. Data lagres ikke i GitHub eller Netlify.
Det finnes ingen automatisk testmerking; slett kjente testsaker i admin før
lansering. Arkivering er ikke umiddelbar sletting: arkiverte saker slettes etter
12 måneder. Vanlige lokale utkast og ubekreftede sendeforsøk følger nettleserlagringen
beskrevet under daglig drift.

Oppsettet over flytter ikke live-nettstedet. Før domeneflytting eller annen endring
som kan påvirke live-nettstedet, varsle eieren og innhent eksplisitt avtale.

Ingen domeneflytting til Cloudflare er nødvendig i denne versjonen. Cloudflare
leverer API-et, og GitHub Pages leverer nettsiden. API-et tillater bare nettleser-
originene i `ALLOWED_ORIGINS`. Direkte kommandolinjekontroller må også oppgi Origin.
CORS er ikke autentisering: alle adminoperasjoner kontrollerer Google-token og
administratorlisten på serveren.

## Lansering

- Når forhåndsvisningen er godkjent: verifiser domeneeierskapet i GitHub-
  organisasjonen og konfigurer hellemyrfau.no under Pages. Sett repository-
  variabelen `PAGES_PRODUCTION` til `true` og kjør workflowen på main; bygget bruker
  da rotstien, API-konfigurasjon og CNAME. Dette er et eget lanseringssteg, ikke en
  del av preview-oppsettet. Flytt deretter DNS etter GitHubs gjeldende A/AAAA/CNAME-
  anvisninger. Behold MX/TXT-poster for e-post og Netlify som retrettmulighet.
  Aktiver Enforce HTTPS når sertifikatet er klart.
- Gjennomgå databehandleravtaler og overføringsgrunnlag for Cloudflare, Google og
  GitHub. Oppdater personvernteksten hvis den faktiske konfigurasjonen avviker.
  D1-meldinger lagres i EU; Worker, botsjekk og Google-innlogging er ikke lovet
  EU-eksklusiv behandling. Ikke aktiver analyseverktøy som del av denne flyttingen.
- Etter eksplisitt avtale om lansering: sett `SUBMISSION_ORIGINS` til
  `https://hellemyrfau.no,https://www.hellemyrfau.no`, `TURNSTILE_HOSTNAMES` til
  `hellemyrfau.no,www.hellemyrfau.no`, og `SUBMISSIONS_OPEN` til `"true"` i
  `wrangler.jsonc`. Fjern preview-origin fra `ALLOWED_ORIGINS`, og publiser Worker.
  Av/på-bryteren alene åpner aldri et domene utenfor `SUBMISSION_ORIGINS`.
- Bruk bare oppdiktede saker: send anonymt og med e-post, logg inn som godkjent
  admin, endre ansvarlig/status, legg til svar og interne notater, slett saken.
  Kontroller at svar bare åpner e-postprogrammet og ikke sendes automatisk.
- Prøv ugyldig innlogging, botsjekkfeil, nettverksfeil, dobbeltklikk og mange
  innsendinger. Ingen bekreftelse skal vises ved feil; utkast skal beholdes.
- Kontroller mobil og stor skjerm, PDF-er, hash-navigasjon, /admin, 404 og HTTPS.
  /admin kan bli kanonisert til /admin/. Begge skal åpne samme innboks.
- Kontroller at ingen gamle Netlify-integrasjoner er aktive. Avvikle eventuelt
  Netlify-prosjekt først etter godkjent test. Ingen saker skal flyttes derfra.
- GitHub Pages støtter ikke vilkårlige HTTP-headere fra vårt repo. Tidligere
  Netlify-headere som X-Frame-Options og Permissions-Policy er derfor ikke
  automatisk videreført. Admin har noindex i HTML; dette er ikke tilgangskontroll.

## Daglig drift og tilgang

Bruk `/admin` til behandling. Nye saker får status «ny». Arkiver ferdigbehandlede
saker; de slettes med tilhørende historikk 12 måneder etter arkivering. Gjentatt
arkivering endrer ikke fristen. Gjenåpning nullstiller den. Gå gjennom aktive,
gamle saker ved hver overlevering. Slett særskilte saker manuelt ved behov.

Automatisk sletting kjøres daglig kl. 03:15 UTC. Kontroller Scheduled Events og
D1-data ved driftsgjennomgang. Worker logger ikke innhold eller tokens, og
observability/request logging er deaktivert i konfigurasjonen. En eventuell
slettefeil logger bare en fast feilmelding. Undersøk med oppdiktede data, og
unngå å aktivere logging av meldingsinnhold.

Ved styrebytte: oppdater `ADMIN_EPOSTER` med secret put, og fjern gamle tilganger
hos Cloudflare, Google og GitHub. Google-token ligger bare i adminnettleserens
sessionStorage til utlogging/utløp. Foreldre trenger ingen konto. IP-adresse brukes
kortvarig som nøkkel i Cloudflares trafikkbegrenser, ikke i saksdatabasen.

Et ubekreftet sendeforsøk lagres med hele skjemainnholdet (også eventuelt navn,
e-post og trinn), fingeravtrykk og UUID i fanens sessionStorage. Ved omlasting
gjenopprettes innholdet sammen med ID-en, slik at nytt forsøk ikke lager en kopi.
Denne kopien fjernes ved bekreftet sending, nullstilling eller når faneøkten
avsluttes. Det vanlige utkastet i localStorage inneholder bare melding og tema.

## Sikkerhetskopi og gjenoppretting

Én navngitt driftsansvarlig tar månedlig eksport til privat, tilgangsbegrenset og
kryptert lagring. Eksporten inneholder personopplysninger. Ikke bruk en offentlig
GitHub-artifact eller last den opp til repo/chat. En lokal mappe alene er ikke
kryptert sikkerhetskopi. Slett eksporter etter senest 30 dager, også ekstra kopier.
D1 Free har i tillegg syv dagers Time Travel; dette erstatter ikke eksporten.

Eksempel på eksport (velg faktisk dato i filnavnet):

```sh
mkdir -p private
npx wrangler d1 export DB --remote --env "" --output private/saker-YYYY-MM-DD.sql
```

Prøv gjenoppretting mot **en tom lokal testdatabase**, aldri direkte i produksjon.
Bruk en egen lokal persist-mappe og produksjonsbindingens navn, men behold `--local`:

```sh
npx wrangler d1 execute DB --local --env "" --persist-to .wrangler/restore-test --file private/saker-YYYY-MM-DD.sql
npx wrangler d1 execute DB --local --env "" --persist-to .wrangler/restore-test --command "SELECT COUNT(*) FROM saker; SELECT COUNT(*) FROM hendelser;"
```

Kontroller antall saker og hendelser og én kjent testsak. Databaseeksporten
inneholder skjemaet; ikke kjør førstegangsmigrering oppå den samme gjenopprettingen.
Test med oppdiktede data under utvikling. SQL-eksport kan åpnes med SQLite-verktøy;
D1 kan også inspiseres gjennom Cloudflare Dashboard.

Produksjonsgjenoppretting er en egen driftsoperasjon: steng mottak, ta vare på
nåværende tilstand, test eksporten lokalt og avtal avbrudd før gjenoppretting.
Saker slettet etter eksporten kan komme tilbake; disse må slettes igjen, og
arkiveringsfristen må håndheves før tjenesten åpnes. Eksporter skal aldri beholdes
utover 30 dager for å omgå sletterutinen.

## Endringer og feil

Kjør `npm test`, `npm run build` og `npm run check:worker`. Lokal database er
uavhengig av produksjon. Gjennomgå PR før merge. Worker publiseres fra gjennomgått
commit med `npm run deploy:worker`; nye migreringer kjøres før kode som trenger dem.
GitHub Actions bygger og publiserer bare nettsiden. Ikke kjør deploy-kommandoer fra
uavklart bidragskode med innlogget Wrangler.

Ved API-feil: sett SUBMISSIONS_OPEN=false og publiser for å stenge nye innsendinger.
Behold utkastene i nettleserne. Gjenopprett en kjent fungerende Worker-versjon via
Cloudflare Dashboard ved kodefeil; ikke rull tilbake database eller slett saker
som del av vanlig kode-rollback. Nettsiden kan publiseres på nytt fra en tidligere
commit. Første lansering har ingen gammel produksjonsversjon å gå tilbake til.

Gratisgrenser: Worker 100 000 kall/døgn og 10 ms CPU per kall; D1 500 MB per database,
5 millioner leste og 100 000 skrevne rader/døgn. Indekser og gjentatt innbokslasting
teller også. Trafikkgrensen er omtrent fem innsendinger/minutt/IP per Cloudflare-
datasenter, ikke en nøyaktig global teller. Turnstile og feltvalidering kommer i tillegg.
Kvotefeil kan gi midlertidig utilgjengelighet; ikke oppgrader automatisk til betalt plan.

Gjeldende leverandørdokumentasjon:
- https://developers.cloudflare.com/d1/configuration/data-location/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site

Dokumentasjon for preview-oppsett:
- https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid
- https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/
