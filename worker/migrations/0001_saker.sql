CREATE TABLE saker (
  id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  mottatt TEXT NOT NULL,
  tema TEXT NOT NULL DEFAULT '',
  melding TEXT NOT NULL,
  navn TEXT NOT NULL DEFAULT '',
  epost TEXT NOT NULL DEFAULT '',
  trinn TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ny' CHECK (status IN ('ny', 'under behandling', 'besvart', 'arkivert')),
  ansvarlig TEXT NOT NULL DEFAULT '',
  arkivert TEXT
);
CREATE INDEX saker_arkivert ON saker(arkivert);
CREATE TABLE hendelser (
  nr INTEGER PRIMARY KEY AUTOINCREMENT,
  sak_id TEXT NOT NULL REFERENCES saker(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('svar', 'notat', 'logg')),
  tid TEXT NOT NULL,
  hvem TEXT NOT NULL,
  epost TEXT NOT NULL DEFAULT '',
  tekst TEXT NOT NULL
);
CREATE INDEX hendelser_sak ON hendelser(sak_id, nr);
