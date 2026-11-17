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
7. Ved førstegangsoppsett: sett `SUBMISSIONS_OPEN=false` før migrering og
   publisering. Den nåværende konfigurasjonen har mottak åpent etter avtale:

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
10. Start workflowen «Build and deploy site» manuelt på main etter oppsettet, eller la
    neste gjennomgåtte endring på main utløse publisering. PR-er kjører kontroller,
    men publiseres ikke. Statisk forhåndsvisning trenger ikke API-nøklene. API-forhåndsvisning og
    produksjonsbygg stopper med feil hvis de offentlige API-variablene mangler.

## GitHub-forhåndsvisning og åpent mottak

Forhåndsvisningen er funksjonstestet: Google-innlogging, innsending, notat,
arkivering/gjenåpning, svar og sletting fungerte, og mobilvisning er kontrollert.
Testsaken er slettet. Eieren har deretter godkjent åpent mottak både på
`https://hellemyrfau.github.io` og de to sluttdomenene `https://hellemyrfau.no`
og `https://www.hellemyrfau.no`. Alle tre finnes i `ALLOWED_ORIGINS` og
`SUBMISSION_ORIGINS`; tilsvarende vertsnavn finnes i `TURNSTILE_HOSTNAMES`.
`SUBMISSIONS_OPEN=true` i repoet trer i kraft ved manuell Worker-publisering
fra gjennomgått kode. Merge alene publiserer ikke Worker-en.

Begge nettsideadressene er offentlige innganger til samme innboks; innsendere
trenger ingen innlogging. Alle innsendelser krever gyldig Turnstile, og
trafikkbegrensning, idempotens og adminverifisering gjelder fortsatt.
CORS/Origin er ikke autentisering av innsendere. Ikke behandle github.io som en
privat testsone. Bruk bare oppdiktede opplysninger ved testing og slett testsaker.

For github.io må følgende være lagret:

1. I Google-prosjektet `hellemyr-fau`, på den eksisterende webklienten:
   `https://hellemyrfau.github.io` under Authorized JavaScript origins, i tillegg
   til begge sluttdomenene. Ingen sti eller redirect URI; innloggingen bruker
   JavaScript-callback. Ingen client secret trengs. Kontroller Audience/Test users
   ved behov mens appen står som External/Testing.
2. I eksisterende Turnstile-widget med site key `0x4AAAAAAGCd9rU6xcCb_d32`:
   `hellemyrfau.github.io` samt begge sluttvertene under Hostname Management.
   Behold Managed og pre-clearance avslått; ikke hent eller roter secret.
3. For github.io-bygget: `PAGES_PREVIEW_API=true`, `PAGES_PRODUCTION` tom/false,
   og de eksisterende offentlige API-variablene i GitHub Actions. Kjør
   «Build and deploy site» på main. Bygget beholder `/nettside/`, noindex og ingen CNAME.

Worker-publisering åpner API-mottaket for alle tre originene. Den flytter ikke
DNS eller Netlify-nettstedet. Når produksjonsbygg og Custom domain senere aktiveres,
brukes rotstier og github.io-adressen videresendes til sluttdomenet.
For å stenge mottaket må av/på-bryteren endres eksplisitt; en vanlig deploy
stenger det **ikke** når repoets konfigurasjon har `SUBMISSIONS_OPEN=true`.
Se avsnittet om feil nedenfor.

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

## Forberedelse før DNS-bytte

Dette kan gjøres før den som har DNS-tilgang er tilgjengelig:

1. Gjennomgå og merge konfigurasjonsendringen. Det publiserer ikke Worker-en
   eller endrer mottakets deployede tilstand. Behold Netlify-appen suspendert.
2. Varsle før publisering: `npm run deploy:worker` fra gjennomgått main åpner
   mottaket for både sluttdomenene og github.io, etter eierens avtale. Alle bruker
   samme database. Preview-login fortsetter å fungere så lenge preview-bygget brukes.
3. Kontroller at begge sluttdomenene fortsatt er lagret i Googles Authorized
   JavaScript origins og Turnstile-widgetens hostname-liste. Ikke hent secrets.
4. Varsle om at preview-adressen endres før neste steg: produksjonsbygget bruker
   rotstier og fungerer ikke lenger som `/nettside/`-preview. Når Custom domain
   lagres, videresender github.io-adressen til hellemyrfau.no (fortsatt Netlify
   fram til DNS-bytte). Netlifys publiserte nettsted og DNS endres ikke av dette.
5. Sett `PAGES_PRODUCTION=true` i GitHub Actions-variablene og kjør «Build and deploy site»
   på main. Vent på vellykket Pages-publisering. Bygget har rotstier, endelig
   API-originliste og ingen preview-noindex på offentlig innhold. Admin beholder
   noindex. Det genererte CNAME er ikke en erstatning for Pages-innstillingen.
6. Sett Pages → Custom domain til `hellemyrfau.no` og lagre **før DNS-bytte**.
   DNS-sjekk og sertifikat kan stå som ventende til DNS peker til GitHub.
   Verifiser gjerne domenet på GitHub-organisasjonen først; TXT-verifisering
   krever at DNS-ansvarlig legger til verdien GitHub oppgir.
7. Meld «klart for DNS-bytte» først når produksjonsbygget er publisert, Pages
   Custom domain er lagret, Worker er publisert med avtalt åpent mottak for alle
   tre originer, og eksterne Google/Turnstile-innstillinger er kontrollert.

Det er ikke nødvendig å endre repoets navn for å bruke rotstien på eget domene.
Behold eksisterende Google-klient, Turnstile-widget, Worker og D1-database.

## DNS-bytte og kontroll

DNS-ansvarlig tar først en privat kopi av eksisterende DNS-poster og TTL-er.
Registraren og den aktive DNS-leverandøren kan være ulike; kontroller autoritative
navnetjenere før endring. Ikke bytt navnetjenere som en del av denne flyttingen.

- Etter eksplisitt avtale flyttes bare nettstedets apex-/www-poster til GitHub
  Pages etter GitHubs gjeldende A/AAAA/CNAME-anvisninger. www-CNAME skal peke til
  `hellemyrfau.github.io`, uten protokoll eller `/nettside/`. Fjern motstridende
  gamle nettstedsposter; behold MX/TXT, andre tjenester og Netlify som retrett.
- Vent på DNS og GitHubs HTTPS-sertifikat. Kontroller apex og www, HTTPS,
  ressursfiler, PDF-er og `/admin/`. Aktiver Enforce HTTPS når sertifikatet er klart.
  Ikke regn midlertidig manglende sertifikat som ferdig lansering.
- Gjennomgå databehandleravtaler og overføringsgrunnlag for Cloudflare, Google og
  GitHub. Oppdater personvernteksten hvis faktisk konfigurasjon avviker.
- Mottaket er allerede åpnet etter avtale under forberedelsen; ingen ny
  Worker-publisering trengs bare fordi DNS byttes. Kontroller HTTPS, innlogging
  og skjema på sluttdomenet før lanseringen regnes som ferdig.
- Test med oppdiktet sak, slett den etterpå, og bekreft at svar bare åpner
  e-postprogrammet; ingen e-post sendes automatisk.
- Avvikling av Netlify er et separat steg etter godkjent drift. Ikke fjern gammel
  hosting eller domenetilknytning under DNS-bytte. Ved behov gjenopprettes bare de
  lagrede nettstedspostene; behold Worker-data og øvrige DNS-poster.
- GitHub Pages støtter ikke vilkårlige HTTP-headere fra repoet. Tidligere
  Netlify-headere er ikke automatisk videreført. Admin-noindex er ikke tilgangskontroll.

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

Ved API-feil: steng nye innsendinger med:

```sh
npx wrangler deploy --env "" --var SUBMISSIONS_OPEN:false
```

Dette overstyrer bryteren i denne publiseringen. Sett også `SUBMISSIONS_OPEN=false`
i repoet gjennom en PR ved vedvarende stenging; ellers åpner neste vanlige deploy
mottaket igjen. Bare å sette `PAGES_PREVIEW_API=false` stenger ikke Worker-mottaket.
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
