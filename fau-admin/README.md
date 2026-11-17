# FAU-innboks

`admin/index.html` viser saker fra nettskjemaet. Google-innlogging og godkjente
administratorer kontrolleres av Cloudflare Worker i `../worker/`. Saker og
historikk lagres i D1 med EU-jurisdiksjon.

Kjør bygg og tester fra repoets rotmappe. Se [README](../README.md) og
[driftsveiledningen](../DRIFT.md). Ikke kopier admin manuelt til nettsidemappen.

Svar lagres i saken. «Send svaret på e-post» åpner administratorens e-postprogram;
lagring alene sender ingen e-post. Interne notater er bare synlige for FAU.
