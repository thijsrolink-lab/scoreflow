# ScoreFlow — Ontwikkelen naast productie

Korte handleiding om veilig nieuwe functies te bouwen zonder de live versie te raken.

## Omgevingen

De app kiest automatisch de juiste database op basis van de hostname (zie bovenaan `index.html`, `SUPA_CONFIG`):

- **Productie** (`lekkergolfen.netlify.app`) → productie-database
- **Lokaal / preview** (localhost, Netlify branch-previews) → testdatabase

Dit betekent: zelfs als je per ongeluk je test-config naar `main` pusht, blijft productie naar de productie-database wijzen.

## Eenmalige setup (testomgeving)

1. Maak een **eigen Supabase project** aan (gratis tier volstaat).
2. Draai in de Supabase SQL Editor eerst `database-schema.sql`, daarna `MIGRATIES.sql`.
3. Vul in `index.html` onder `SUPA_CONFIG.test` jouw test-URL en anon key in:
   ```js
   test: {
     url: 'https://JOUW-TEST-PROJECT.supabase.co',
     key: 'jouw-test-anon-key'
   }
   ```
4. Commit dit alleen in je **feature-branch**, niet in `main` — zo blijft de testconfig uit productie.

## Werkwijze per functie

1. Maak een branch: `git checkout -b functie/naam-van-functie`
2. Bouw en test lokaal (`python3 -m http.server 8000` → `http://localhost:8000`) — gebruikt automatisch je testdatabase.
3. Vóór commit altijd:
   ```bash
   node --check <geëxtraheerd script>   # of gebruik de bestaande check
   ./tests/run-tests.sh                  # alle tests groen
   ```
4. Push de branch en open een **pull request** naar de hoofdrepo.
5. De lead reviewt en merget naar `main` → Netlify deployt naar productie.

## Belangrijk

- Werk **nooit** direct op `main`.
- Zet je test-keys **nooit** in `SUPA_CONFIG.productie`.
- Voeg nieuwe productie-domeinen toe aan `PROD_HOSTS` bovenaan `index.html`.
- Nieuwe database-kolommen of -tabellen: voeg ze toe aan `MIGRATIES.sql` zodat de lead ze ook op productie kan draaien.
