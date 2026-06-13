# ScoreFlow — Overdrachtsdocument

Dit document beschrijft de volledige opzet van ScoreFlow zodat een nieuwe ontwikkelaar of partner het project kan overnemen en draaien.

---

## 1. Wat is ScoreFlow?

ScoreFlow is een Nederlandstalige SaaS-applicatie voor het beheren van golftoernooien: wedstrijden aanmaken, inschrijvingen, flights, live scoreverwerking, leaderboards, competities en rapportages. De applicatie draait als white-label platform voor golfclubs. De eerste pilot draaide bij De Hooge Rotterdamsche.

De handicap-berekening (CR/slope-verwerking, qualifying scores naar de bond) wordt **niet** door ScoreFlow zelf gedaan — dat loopt via een geplande koppeling met Golfspot.

---

## 2. Architectuur in één oogopslag

| Laag | Technologie |
|------|-------------|
| Frontend | Eén `index.html` (~19.900 regels, Vanilla JS, geen build-stap) + `leaderboard.html` |
| Backend | Supabase (PostgreSQL + Row Level Security) |
| Serverless | Netlify Functions (`ai-chat.js`, `ai-kalender.js`) |
| Hosting/CI | Netlify, auto-deploy bij elke push naar `main` |
| PWA | Service worker (`sw.js`) + `manifest.json`, offline score-queue |

De applicatie is bewust opgezet als één groot HTML-bestand zonder framework of build-stap. Dat maakt snel itereren mogelijk, maar betekent ook dat layout- en scoping-bugs (duplicate IDs, scroll-containers) extra aandacht vragen.

---

## 3. Repository

- **GitHub:** `github.com/thijsrolink-lab/scoreflow`
- **Branch:** `main` (auto-deploy)
- **Belangrijke bestanden:**
  - `index.html` — de volledige admin- en spelersapplicatie
  - `leaderboard.html` — losse live-leaderboard weergave
  - `sw.js` — service worker (PWA, offline)
  - `manifest.json` — PWA manifest
  - `netlify.toml` — headers, redirects, SPA-fallback
  - `netlify/functions/ai-chat.js` — AI-assistent (Claude)
  - `netlify/functions/ai-kalender.js` — AI-kalender generator
  - `database-schema.sql` — basis databaseschema
  - `tests/` — testsuite (`run-tests.sh`, target: alle groen)

### Toegang overdragen
GitHub → repo Settings → Collaborators → nodig de nieuwe eigenaar uit (of draag eigendom over via Settings → Danger Zone → Transfer ownership).

---

## 4. Hosting (Netlify)

- De Netlify-site is gekoppeld aan de GitHub-repo en deployt automatisch bij elke push naar `main`.
- Publieke URL pilot: `lekkergolfen.netlify.app`
- **Environment variables** (Netlify → Site settings → Environment variables) — vereist voor de AI-functies:
  - `ANTHROPIC_API_KEY` — gebruikt door `ai-chat.js` en `ai-kalender.js`

### Overdragen
Netlify → Team settings → nodig de nieuwe eigenaar uit, of verplaats de site naar een ander team. Zorg dat de environment variables in het nieuwe team opnieuw gezet worden.

---

## 5. Database (Supabase)

- **Project URL:** `https://zyxusjhxncwytohjxrnu.supabase.co`
- De anon key staat in `index.html` (rond regel 5619). Dit is normaal voor een frontend — de beveiliging hangt volledig op Row Level Security (RLS).
- **Belangrijk:** controleer dat RLS op álle tabellen aanstaat en correct is. Zie sectie 7.

### Tabellen in gebruik
`wedstrijden`, `gebruikers`, `inschrijvingen`, `flights`, `scores`, `competities`,
`commissies`, `commissie_leden`, `sponsoren`, `wedstrijd_sponsoren`,
`team_drives`, `groepswedstrijden`, `audit_log`

### Overdragen
Supabase → Project Settings → Team → nodig de nieuwe eigenaar uit, of draag het project over naar een andere organisatie. De anon key in `index.html` moet meeverhuizen als het Supabase-project verandert.

---

## 6. Database-migraties (volledige lijst)

Voer deze uit in de Supabase SQL Editor als je een verse database opzet of een bestaande bijwerkt. Alle statements zijn idempotent (`IF NOT EXISTS`).

```sql
-- Wedstrijd: uitgebreide velden
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS commissie_id uuid REFERENCES commissies(id) ON DELETE SET NULL;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS qualifying boolean DEFAULT true;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS tiebreak text;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS leeftijd_min int;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS leeftijd_max int;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS toelating_gs text;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS tees jsonb;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS categorieen jsonb;
ALTER TABLE wedstrijden ADD COLUMN IF NOT EXISTS special_holes jsonb;

-- Competities
ALTER TABLE competities ADD COLUMN IF NOT EXISTS puntenschema jsonb;

-- Commissies
CREATE TABLE IF NOT EXISTS commissies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  naam text NOT NULL,
  kleur text DEFAULT '#3b82f6',
  aangemaakt_op timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commissie_leden (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commissie_id uuid REFERENCES commissies(id) ON DELETE CASCADE,
  gebruiker_id uuid,
  aangemaakt_op timestamptz DEFAULT now()
);

-- Audit log: ontbrekende kolommen op bestaande tabel
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_naam text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS object_naam text;
```

> Let op: de `audit_log` tabel gebruikt `ts` (niet `created_at`), `user_email` en `record_id` als bestaande kolomnamen. De applicatie sluit daarop aan.

---

## 7. Row Level Security (RLS)

RLS is de enige beveiligingslaag tussen de publieke anon key en de data. Het patroon is: iedereen mag lezen (publiek leaderboard), ingelogde gebruikers mogen schrijven. Pas strenger aan waar gewenst.

```sql
-- Herhaal dit blok per tabel: competities, team_drives, sponsoren,
-- wedstrijd_sponsoren, groepswedstrijden, commissies, commissie_leden
ALTER TABLE <tabel> ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "<tabel>_select" ON <tabel>;
DROP POLICY IF EXISTS "<tabel>_insert" ON <tabel>;
DROP POLICY IF EXISTS "<tabel>_update" ON <tabel>;
DROP POLICY IF EXISTS "<tabel>_delete" ON <tabel>;
CREATE POLICY "<tabel>_select" ON <tabel> FOR SELECT USING (true);
CREATE POLICY "<tabel>_insert" ON <tabel> FOR INSERT WITH CHECK (true);
CREATE POLICY "<tabel>_update" ON <tabel> FOR UPDATE USING (true);
CREATE POLICY "<tabel>_delete" ON <tabel> FOR DELETE USING (true);

-- audit_log: alleen lezen voor admins, inserts toegestaan
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (true);
-- (SELECT policy bestaat al via is_admin())
```

> **Aandachtspunt bij overdracht:** loop alle tabellen na en controleer dat RLS daadwerkelijk aanstaat. Een tabel zonder policies blokkeert óf alles (met RLS aan) óf laat alles toe (met RLS uit) — beide ongewenst.

---

## 8. Lokaal draaien / aanpassen

Er is geen build-stap. Werkwijze:

1. Clone de repo: `git clone https://github.com/thijsrolink-lab/scoreflow.git`
2. Open `index.html` rechtstreeks in de browser, of serveer lokaal:
   `python3 -m http.server 8000` en ga naar `http://localhost:8000`
3. De app praat direct met de live Supabase (anon key staat in de code).
4. Na wijzigingen: draai de checks (zie sectie 9), commit, push → Netlify deployt automatisch.

> De AI-functies (`/.netlify/functions/...`) werken alleen op Netlify of via `netlify dev` (Netlify CLI), omdat ze de `ANTHROPIC_API_KEY` environment variable nodig hebben.

---

## 9. Tests & kwaliteitscontrole

Vóór elke push:

```bash
# JS-syntax check (extraheer het script en valideer)
node --check <geëxtraheerd script>

# Testsuite (verwacht: alle tests groen)
./tests/run-tests.sh
```

De testsuite controleert onder andere:
- Golf-scoring engines (Stableford, Strokeplay, etc.)
- Form-roundtrips: wizard-veld → app-object → database-kolom → terug
- Div-balans per view (voorkomt layout-/scoping-bugs door ongebalanceerde `<div>`'s)

---

## 10. Belangrijke aandachtspunten & valkuilen

- **Golf-scoring is precies en foutgevoelig.** Eerdere bugs kwamen door subtiele datafouten: verkeerde kolomnamen, hardcoded "welke negen holes", onjuiste stroke-index arrays, verkeerde CR per zijde. Valideer scoringswijzigingen altijd met de tests.
- **Live leaderboard is de kernwaarde** — bevestigd door pilotfeedback. Het is de feature die spelers het meest waarderen.
- **Eén groot bestand.** `index.html` is ~19.900 regels. Voordeel: snel itereren. Nadeel: duplicate IDs en scroll-container-conflicten zijn lastig te isoleren. De div-balans test helpt hierbij.
- **Secrets nooit in code of git.** De Supabase anon key mag in de frontend (RLS beschermt). Maar service-keys, GitHub tokens en de Anthropic API-key horen NOOIT in de repo of in chats — gebruik environment variables.
- **Tekst en golf-terminologie is Nederlands** door de hele applicatie.

---

## 11. Checklist voor de overdracht

- [ ] GitHub repo-toegang overgedragen (of eigendom overgedragen)
- [ ] Supabase project-toegang overgedragen
- [ ] Netlify site-toegang overgedragen
- [ ] `ANTHROPIC_API_KEY` opnieuw gezet in het Netlify-team van de ontvanger
- [ ] Alle database-migraties (sectie 6) uitgevoerd op de doeldatabase
- [ ] RLS gecontroleerd op alle tabellen (sectie 7)
- [ ] Persoonlijke GitHub tokens van de oude eigenaar ingetrokken/geroteerd
- [ ] Testsuite draait groen op de machine van de ontvanger
- [ ] Eén testwedstrijd aangemaakt → gepubliceerd → score ingevoerd → leaderboard gecontroleerd

---

## 12. Functionele modules (overzicht)

- **Overzicht:** Dashboard, Mijn taken (actiegerichte takenlijst per wedstrijd)
- **Wedstrijden:** Kalender, Alle wedstrijden (met commissie-filter en leider-highlight), 6-staps aanmaak-wizard, Templates
- **Competities:** reeks losse wedstrijden met gecombineerd klassement (eclectic, Order of Merit met aanpasbaar puntenschema), inschrijving op competitieniveau
- **Spelers:** Clubleden, Deelnemers
- **Inzichten:** Rapportages, Audit log (30 dagen retentie)
- **Beheer:** Gebruikers & rollen (Admin / Wedstrijdleider / Wedstrijdplanner met aanpasbare rechten), Commissies, Notificaties, Baaninformatie
- **Instellingen:** clubinstellingen
- **AI Assistent:** Claude-gebaseerde chat + kalendergeneratie
- **Spelersportaal:** kalender, inschrijvingen, competities, scores, profiel
- **PWA:** offline score-invoer met auto-sync bij herverbinding

---

*Laatst bijgewerkt bij de overdracht. Voor de actuele staat: raadpleeg de git-historie van de repo.*
