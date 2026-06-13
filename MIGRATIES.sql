-- ============================================================
-- ScoreFlow — Volledige database-migraties
-- ============================================================
-- Voer dit volledige bestand uit in de Supabase SQL Editor.
-- Alle statements zijn idempotent (IF NOT EXISTS) — veilig
-- om meerdere keren te draaien.
--
-- Volgorde: 1) tabellen, 2) kolommen, 3) RLS policies.
-- ============================================================


-- ============================================================
-- 1. TABELLEN
-- ============================================================

-- Commissies
CREATE TABLE IF NOT EXISTS commissies (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam          text NOT NULL,
  kleur         text DEFAULT '#3b82f6',
  aangemaakt_op timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commissie_leden (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commissie_id  uuid REFERENCES commissies(id) ON DELETE CASCADE,
  gebruiker_id  uuid,
  aangemaakt_op timestamptz DEFAULT now()
);

-- Competities (reeks wedstrijden met gecombineerd klassement)
CREATE TABLE IF NOT EXISTS competities (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam          text NOT NULL,
  type          text DEFAULT 'eclectic',
  start_datum   date,
  eind_datum    date,
  omschrijving  text,
  baan          text,
  cr            numeric,
  slope         int,
  holes         int DEFAULT 18,
  hcp_perc      int DEFAULT 100,
  min_rondes    int DEFAULT 2,
  ecl_hcp_perc  numeric DEFAULT 0.75,
  wids          jsonb DEFAULT '[]'::jsonb,
  status        text DEFAULT 'actief',
  puntenschema  jsonb,
  aangemaakt_op timestamptz DEFAULT now()
);

-- Sponsoren
CREATE TABLE IF NOT EXISTS sponsoren (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam          text NOT NULL,
  logo          text,
  website       text,
  contact       text,
  email         text,
  bedrag        numeric,
  aangemaakt_op timestamptz DEFAULT now()
);

-- Wedstrijd-sponsoren koppeltabel
CREATE TABLE IF NOT EXISTS wedstrijd_sponsoren (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wedstrijd_id  text,
  sponsor_id    uuid REFERENCES sponsoren(id) ON DELETE CASCADE,
  type          text DEFAULT 'hoofdsponsor',
  hole_nr       int,
  aangemaakt_op timestamptz DEFAULT now()
);

-- Team drives (Texas Scramble — welke speler dreef op welke hole)
CREATE TABLE IF NOT EXISTS team_drives (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wid           text,
  sid           text,
  hole          int,
  drives        int,
  aangemaakt_op timestamptz DEFAULT now()
);

-- Audit log (indien nog niet aanwezig)
CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts          timestamptz DEFAULT now(),
  user_id     uuid,
  user_email  text,
  actie       text NOT NULL,
  tabel       text,
  record_id   text
);



-- ============================================================
-- 2. KOLOMMEN
-- ============================================================

-- Wedstrijd: uitgebreide velden (wizard 6-staps model)
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS commissie_id  uuid REFERENCES commissies(id) ON DELETE SET NULL;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS qualifying    boolean DEFAULT true;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS tiebreak      text;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS leeftijd_min  int;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS leeftijd_max  int;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS toelating_gs  text;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS tees          jsonb;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS categorieen   jsonb;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS special_holes jsonb;

-- Competities: aanpasbaar puntenschema (Order of Merit)
ALTER TABLE competities ADD COLUMN IF NOT EXISTS puntenschema jsonb;

-- Audit log: ontbrekende kolommen op bestaande tabel
-- (tabel gebruikt ts, user_email, record_id als bestaande kolomnamen)
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_naam   text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details     text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS object_naam text;


-- ============================================================
-- 3. ROW LEVEL SECURITY
-- ============================================================
-- Patroon: iedereen mag lezen (publiek leaderboard),
-- ingelogde gebruikers mogen schrijven.
-- Pas strenger aan waar gewenst.

-- ── commissies ────────────────────────────────────────────
ALTER TABLE commissies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commissies_select" ON commissies;
DROP POLICY IF EXISTS "commissies_insert" ON commissies;
DROP POLICY IF EXISTS "commissies_update" ON commissies;
DROP POLICY IF EXISTS "commissies_delete" ON commissies;
CREATE POLICY "commissies_select" ON commissies FOR SELECT USING (true);
CREATE POLICY "commissies_insert" ON commissies FOR INSERT WITH CHECK (true);
CREATE POLICY "commissies_update" ON commissies FOR UPDATE USING (true);
CREATE POLICY "commissies_delete" ON commissies FOR DELETE USING (true);

-- ── commissie_leden ───────────────────────────────────────
ALTER TABLE commissie_leden ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commissie_leden_select" ON commissie_leden;
DROP POLICY IF EXISTS "commissie_leden_insert" ON commissie_leden;
DROP POLICY IF EXISTS "commissie_leden_update" ON commissie_leden;
DROP POLICY IF EXISTS "commissie_leden_delete" ON commissie_leden;
CREATE POLICY "commissie_leden_select" ON commissie_leden FOR SELECT USING (true);
CREATE POLICY "commissie_leden_insert" ON commissie_leden FOR INSERT WITH CHECK (true);
CREATE POLICY "commissie_leden_update" ON commissie_leden FOR UPDATE USING (true);
CREATE POLICY "commissie_leden_delete" ON commissie_leden FOR DELETE USING (true);

-- ── competities ───────────────────────────────────────────
ALTER TABLE competities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "competities_select" ON competities;
DROP POLICY IF EXISTS "competities_insert" ON competities;
DROP POLICY IF EXISTS "competities_update" ON competities;
DROP POLICY IF EXISTS "competities_delete" ON competities;
CREATE POLICY "competities_select" ON competities FOR SELECT USING (true);
CREATE POLICY "competities_insert" ON competities FOR INSERT WITH CHECK (true);
CREATE POLICY "competities_update" ON competities FOR UPDATE USING (true);
CREATE POLICY "competities_delete" ON competities FOR DELETE USING (true);

-- ── team_drives ───────────────────────────────────────────
ALTER TABLE team_drives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_drives_select" ON team_drives;
DROP POLICY IF EXISTS "team_drives_insert" ON team_drives;
DROP POLICY IF EXISTS "team_drives_update" ON team_drives;
DROP POLICY IF EXISTS "team_drives_delete" ON team_drives;
CREATE POLICY "team_drives_select" ON team_drives FOR SELECT USING (true);
CREATE POLICY "team_drives_insert" ON team_drives FOR INSERT WITH CHECK (true);
CREATE POLICY "team_drives_update" ON team_drives FOR UPDATE USING (true);
CREATE POLICY "team_drives_delete" ON team_drives FOR DELETE USING (true);

-- ── sponsoren ─────────────────────────────────────────────
ALTER TABLE sponsoren ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sponsoren_select" ON sponsoren;
DROP POLICY IF EXISTS "sponsoren_insert" ON sponsoren;
DROP POLICY IF EXISTS "sponsoren_update" ON sponsoren;
DROP POLICY IF EXISTS "sponsoren_delete" ON sponsoren;
CREATE POLICY "sponsoren_select" ON sponsoren FOR SELECT USING (true);
CREATE POLICY "sponsoren_insert" ON sponsoren FOR INSERT WITH CHECK (true);
CREATE POLICY "sponsoren_update" ON sponsoren FOR UPDATE USING (true);
CREATE POLICY "sponsoren_delete" ON sponsoren FOR DELETE USING (true);

-- ── wedstrijd_sponsoren ───────────────────────────────────
ALTER TABLE wedstrijd_sponsoren ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wedstrijd_sponsoren_select" ON wedstrijd_sponsoren;
DROP POLICY IF EXISTS "wedstrijd_sponsoren_insert" ON wedstrijd_sponsoren;
DROP POLICY IF EXISTS "wedstrijd_sponsoren_update" ON wedstrijd_sponsoren;
DROP POLICY IF EXISTS "wedstrijd_sponsoren_delete" ON wedstrijd_sponsoren;
CREATE POLICY "wedstrijd_sponsoren_select" ON wedstrijd_sponsoren FOR SELECT USING (true);
CREATE POLICY "wedstrijd_sponsoren_insert" ON wedstrijd_sponsoren FOR INSERT WITH CHECK (true);
CREATE POLICY "wedstrijd_sponsoren_update" ON wedstrijd_sponsoren FOR UPDATE USING (true);
CREATE POLICY "wedstrijd_sponsoren_delete" ON wedstrijd_sponsoren FOR DELETE USING (true);

-- ── groepswedstrijden ─────────────────────────────────────
ALTER TABLE groepswedstrijden ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "groepswedstrijden_select" ON groepswedstrijden;
DROP POLICY IF EXISTS "groepswedstrijden_insert" ON groepswedstrijden;
DROP POLICY IF EXISTS "groepswedstrijden_update" ON groepswedstrijden;
DROP POLICY IF EXISTS "groepswedstrijden_delete" ON groepswedstrijden;
CREATE POLICY "groepswedstrijden_select" ON groepswedstrijden FOR SELECT USING (true);
CREATE POLICY "groepswedstrijden_insert" ON groepswedstrijden FOR INSERT WITH CHECK (true);
CREATE POLICY "groepswedstrijden_update" ON groepswedstrijden FOR UPDATE USING (true);
CREATE POLICY "groepswedstrijden_delete" ON groepswedstrijden FOR DELETE USING (true);

-- ── audit_log ─────────────────────────────────────────────
-- Lezen: alleen admins (via bestaande is_admin() policy).
-- Inserts: toegestaan zodat de applicatie acties kan loggen.
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS audit_log_ts_idx ON audit_log (ts DESC);


-- ============================================================
-- KLAAR
-- ============================================================
-- Optioneel: opruimen oude audit-entries (>30 dagen).
-- De applicatie doet dit ook automatisch bij openen van de
-- audit log view, maar je kunt het ook periodiek draaien:
--
--   DELETE FROM audit_log WHERE ts < now() - interval '30 days';
-- ============================================================
