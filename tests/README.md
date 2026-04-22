# ScoreFlow Tests

## Hoe draai ik tests?

```bash
# Alle tests
./tests/run-tests.sh

# Alleen statische validatie (5 sec)
node tests/validate.js

# Alleen engine tests (5 sec)
node tests/test-engines.js
```

## Wat wordt getest?

### `validate.js` — Statische validatie van `index.html`

Vangt de bugs die we vandaag hadden:

- HTML structuur (DOCTYPE, meta, viewport)
- Script tags balanced en correct afgesloten
- JavaScript syntax via Node's VM module
- Geen dubbele functie-definities
- Alle `onclick="..."` handlers verwijzen naar bestaande functies
- Kritieke login functies bestaan (`loginAs`, `doLogin`, `startSessie`)
- **Regressies**:
  - Geen `esc()` aanroepen (moet `escHtml()` zijn)
  - Geen `parseInt()` op dropdown UUID's
  - UUID IDs in onclick handlers tussen quotes
  - Geen losse JavaScript in HTML (broncode lek)
  - Script tag vóór inline onclick handlers

### `test-engines.js` — Unit tests voor rekenlogica

- Speelhandicap (WHS formule)
- Extra slagen per hole (SI verdeling)
- Stableford punten
- Strokeplay netto/bruto + ESC capping
- Snake flight-indeling (gebalanceerd)
- Eclectic (beste score per hole)

## Wanneer worden tests gedraaid?

- **Lokaal**: elke keer voordat je `git push` doet
- **GitHub Actions**: automatisch bij elke push naar `main` of PR
- Als tests falen: rode cross in GitHub, Netlify blokkeert de deploy

## Nieuwe test toevoegen?

Open `tests/validate.js` of `tests/test-engines.js` en voeg een nieuwe `test(...)` toe in een bestaande of nieuwe `section(...)`.
