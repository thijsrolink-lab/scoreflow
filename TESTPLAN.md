# ScoreFlow — Testplan

Een systematisch plan om ScoreFlow volledig te testen vóór de Laravel-herbouw. Dit document is tegelijk de **contractspecificatie**: de Laravel-versie is pas klaar als hij elk scenario hieronder met dezelfde uitkomst doorstaat.

---

## Hoe dit plan te gebruiken

Er zijn drie soorten tests, elk met een eigen doel:

1. **Unit-tests (geautomatiseerd)** — de scoring-engines. Pure berekeningen met een bekende input en een bekende uitkomst. Dit is de kern: golf-scoring is precies en foutgevoelig. Draaien via `./tests/run-tests.sh`.
2. **Integratietests (half-geautomatiseerd)** — datastromen: form → app-object → database → terug. Deels gedekt door de bestaande roundtrip-tests in `validate.js`.
3. **Scenariotests (handmatig)** — end-to-end gebruikersflows in de browser, met een checklist. Voor wat je niet zinvol kunt automatiseren (UI, PWA, realtime).

**Aanpak:** werk van binnen naar buiten. Eerst alle scoring-engines waterdicht (unit), dan de datastromen (integratie), dan de flows (scenario). Een bug in de scoring-laag maakt alle tests daarboven onbetrouwbaar.

**Definitie van "klaar":** elke vorm heeft minimaal de scenario's uit sectie 3 als groene test, en elke gebruikersflow uit sectie 5 is minimaal één keer handmatig doorlopen en afgevinkt.

---

## 1. Teststrategie & prioriteiten

| Prioriteit | Wat | Waarom |
|-----------|-----|--------|
| **P1 — kritiek** | Scoring-engines (alle 20 vormen) | Foute scores = direct verkeerde uitslag, ondermijnt vertrouwen |
| **P1 — kritiek** | Speelhandicap-berekening | Zit onder bijna elke vorm; fout hier = overal fout |
| **P2 — hoog** | Live leaderboard, score-invoer | Kernwaarde, real-time, veel gebruikt |
| **P2 — hoog** | Wedstrijd aanmaken (wizard), inschrijving, flights | Hoofd-workflow |
| **P3 — middel** | Competities, OoM-puntenschema, categorieën | Complex maar minder frequent |
| **P3 — middel** | Audit log, rollen/rechten, commissies | Beheerfuncties |
| **P4 — lager** | PWA/offline, rapportages, AI | Ondersteunend |

---

## 2. Fundament: speelhandicap & hulpfuncties (P1)

Deze worden door bijna alle vormen gebruikt. Eerst hier 100% zekerheid.

### 2.1 berekenSpeelhandicap
- [ ] HCP 18.0, slope 131, CR 72.1, par 72 → verwachte SH volgens WHS-formule `round(HCP × slope/113 + (CR − par))`
- [ ] HCP 36.0 (max regulier) → SH 42
- [ ] HCP 0.0 (scratch) → SH ≈ CR − par
- [ ] HCP 54.0 (max WHS) → correcte hoge SH
- [ ] Negatieve handicap (plus-speler, bijv. +2.0) → SH lager dan scratch
- [ ] HCP% 75% → SH is 75% van vol
- [ ] HCP% 0% → SH = 0 (bruto-only)
- [ ] 9 holes → ongeveer halve SH
- [ ] 9 holes IN (holes 10-18) vs UIT (1-9) → juiste CR/slope/SI per zijde

### 2.2 extraSlagenPerHole (slagenverdeling over stroke-index)
- [ ] SH 0 → elke hole 0 extra
- [ ] SH 18 → elke hole exact 1 extra
- [ ] SH 9 → SI 1-9 krijgen 1, SI 10-18 krijgen 0
- [ ] SH 24 → 6 holes (SI 1-6) krijgen 2, rest 1
- [ ] SH 36 → elke hole 2
- [ ] SH 37 → SI 1 krijgt 3, rest 2
- [ ] 9-holes ronde → verdeling alleen over de gespeelde 9 SI's

### 2.3 ESC / score-aanpassing (pasESCtoe)
- [ ] ESC 'geen' → score ongewijzigd
- [ ] ESC 'double' → score gecapt op netto dubbel bogey
- [ ] ESC 'triple' → gecapt op triple
- [ ] Score onder de cap → ongewijzigd

> **Randvoorwaarde:** controleer dat de gebruikte SI-array en par-array per baan/tee kloppen. Eerdere bugs kwamen door verkeerde SI-arrays en verkeerde CR per zijde.

---

## 3. Scoring-engines per wedstrijdvorm (P1)

Voor **elke** vorm gelden deze basisscenario's. Per vorm staat hieronder wat specifiek getest moet worden.

**Standaard basisscenario's (op elke vorm toepassen):**
- [ ] **Perfecte par-ronde** (18× par) met SH 0 → bekende referentie-uitkomst
- [ ] **Par-ronde met SH 18** → effect van handicapverrekening zichtbaar
- [ ] **Lege scorekaart** → 0 punten / geen uitslag, geen crash
- [ ] **Incomplete ronde** (bijv. 9 van 18 holes ingevuld) → telt alleen ingevulde holes, markeert als niet-compleet
- [ ] **Extreme scores** (alles 10+) → geen negatieve of onzinnige uitkomst
- [ ] **9-holes variant** → halve baan correct

### Individuele vormen

**3.1 Stableford** *(al getest — uitbreiden)*
- [x] 18× par, SH 0 → 36 punten
- [x] 18× par, SH 18 → 54 punten
- [x] Alleen dubbel bogey of slechter → 0 punten
- [ ] Eagle/albatross → 4/5 punten op die hole
- [ ] Mix van birdies, pars, bogeys → handmatig narekenen

**3.2 Strokeplay** *(al getest — uitbreiden)*
- [x] 18× par, SH 0 → bruto 72, netto 72
- [x] 18× par, SH 18 → bruto 72, netto 54
- [x] ESC capt scores
- [ ] Tie op netto → tiebreak via countback (zie 3.x)

**3.3 Modified Stableford** *(nieuw)*
- [ ] Puntenschema per resultaat (eagle/birdie/par/bogey) correct toegepast
- [ ] Negatieve punten bij slecht resultaat (indien schema dat kent)
- [ ] Vergelijk met gewone Stableford om verschil te bevestigen

**3.4 Bogey competition** *(nieuw)*
- [ ] Netto onder/op par → gewonnen hole (+1)
- [ ] Netto = par+1 → gelijk (0)
- [ ] Netto slechter → verloren (−1)
- [ ] Totaal = gewonnen − verloren; tellers (gewonnen/gelijk/verloren) kloppen

**3.5 Par competition** *(nieuw)*
- [ ] Netto < par → +1, netto = par → 0, netto > par → −1
- [ ] Eindresultaat als +/− totaal
- [ ] Verschil met Bogey competition bevestigen (grensgevallen)

**3.6 Matchplay** *(nieuw — speler tegen speler)*
- [ ] Hogere handicapper krijgt verschilslagen op juiste SI-holes
- [ ] Hole gewonnen/gehalveerd/verloren correct
- [ ] Stand "3 up met 2 te gaan" → match beslist (dormie/gewonnen)
- [ ] All square na 18 → gelijk
- [ ] Speler A wint alle holes → maximale voorsprong

**3.7 Skins** *(nieuw)*
- [ ] Laagste score wint de skin
- [ ] Gelijke laagste → skin carry-over naar volgende hole (pot stapelt)
- [ ] Met handicap vs zonder handicap → verschillende winnaars
- [ ] Pot-verdeling klopt aan het eind

**3.8 Eclectic** *(al getest — uitbreiden)*
- [x] Beste score per hole over meerdere rondes
- [ ] Minimum aantal rondes voor geldig klassement
- [ ] Eclectic handicap% toegepast

**3.9 Vlaggenwedstrijd** *(nieuw)*
- [ ] Beschikbare slagen = par + SH; vlag geplant waar slagen op zijn
- [ ] Verder komen = hoger geklasseerd
- [ ] Speler die ronde uitspeelt met slagen over → afstand voorbij laatste hole

**3.10 Shoot-out** *(nieuw)*
- [ ] Laatste speler valt af per hole/ronde
- [ ] Gelijkspel bij afvallen → tiebreak-regel

**3.11 Rabbit** *(nieuw)*
- [ ] "Rabbit" wisselt volgens regels van bezit
- [ ] Eindbezit bepaalt winnaar

**3.12 Amerikaantje** *(al getest)*
- [x] Puntenverdeling per hole (4-1-1, 3-3-0, 2-2-2 bij gelijkspel)
- [x] Hole met onvolledige scores correct afgehandeld

**3.13 Order of Merit** *(nieuw — competitieklassement)*
- [ ] Punten per eindpositie volgens schema
- [ ] Optelling over meerdere rondes
- [ ] Spelers buiten schema krijgen deelnamepunten
- [ ] Aanpasbaar schema wordt gerespecteerd

### Teamvormen

**3.14 Texas Scramble / Shamble** *(nieuw)*
- [ ] Beste drive per hole + teamscore
- [ ] Teamhandicap-berekening
- [ ] Minimum aantal drives per speler (indien regel actief)

**3.15 Fourball** *(nieuw)*
- [ ] Beste netto-bal van twee partners per hole
- [ ] Stableford- of strokeplay-variant

**3.16 Greensome / Foursomes** *(nieuw)*
- [ ] Foursomes: om-en-om slaan, één bal
- [ ] Greensome: beide slaan af, daarna één bal
- [ ] Gecombineerde teamhandicap

**3.17 Alliance** *(nieuw)*
- [ ] Beste X van Y scores per hole tellen
- [ ] Teamtotaal correct

**3.18 Team Stableford** *(nieuw)*
- [ ] Teamtotaal van individuele Stableford-punten
- [ ] Tellende scores per hole correct

**3.19 Chapman** *(nieuw)*
- [ ] Specifieke Chapman-volgorde (beide af, wisselen, dan één bal)
- [ ] Handicapberekening volgens Chapman-regel

---

## 4. Tiebreak & countback (P1)

- [x] Countback berekent laatste 9/6/3/1 correct
- [x] Birdie op hole 18 telt mee in laatste 1
- [x] Incomplete ronde → 999 voor ontbrekende segmenten (laatste plaats)
- [ ] **Tiebreak 'matching'**: twee gelijke totalen → beste laatste 9 wint; bij gelijk → laatste 6, dan 3, dan 1
- [ ] **Tiebreak 'loting'**: willekeurige volgorde, geen crash
- [ ] **Tiebreak 'laagste hcp'**: laagste handicap wint de tie
- [ ] **Tiebreak 'delen'**: beide spelers delen de plaats

---

## 5. Scenariotests — gebruikersflows (P2, handmatig)

Per flow: doorloop in de browser, vink af. Test waar mogelijk als élke rol (Admin / Wedstrijdleider / Wedstrijdplanner / Speler).

### 5.1 Wedstrijd-levenscyclus (de hoofdflow)
- [ ] Nieuwe wedstrijd via wizard (alle 6 stappen), Stableford, 18 holes
- [ ] Concept opslaan → verschijnt in overzicht als concept
- [ ] Bewerken → alle velden komen correct terug (incl. tees, categorieën, special holes)
- [ ] Publiceren → status gepubliceerd, zichtbaar voor spelers
- [ ] Spelers inschrijven (tot boven max → wachtlijst)
- [ ] Flights indelen (automatisch + handmatig verplaatsen)
- [ ] Wedstrijd starten → live, scorekaart open
- [ ] Scores invoeren → live leaderboard werkt bij
- [ ] Afronden → uitslag definitief
- [ ] Audit log toont alle bovenstaande acties met juiste gebruiker

### 5.2 Wedstrijd-varianten
- [ ] 9-holes wedstrijd (UIT en IN apart testen)
- [ ] Meerdere rondes (bijv. 3) op één wedstrijd
- [ ] Wedstrijd met meerdere tees + categorieën → klassement per categorie
- [ ] Non-qualifying wedstrijd → label zichtbaar
- [ ] Wedstrijd afgelasten met reden → heractiveren
- [ ] Wedstrijd dupliceren
- [ ] Wedstrijd verwijderen (let op: crashte eerder — extra aandacht)

### 5.3 Inschrijvingen
- [ ] Speler schrijft zichzelf in via portaal
- [ ] Admin schrijft speler in
- [ ] Toelatingseisen blokkeren buiten-range speler (HCP/geslacht/leeftijd)
- [ ] Wachtlijst: toelaten als er plek vrijkomt
- [ ] Afmelden

### 5.4 Competities
- [ ] Competitie aanmaken met 6 gegenereerde rondes
- [ ] Rondes verschijnen als losse wedstrijden, gekoppeld
- [ ] Speler inschrijven op competitieniveau → in alle rondes
- [ ] Afmelden van competitie → uit alle rondes
- [ ] Order of Merit klassement met aangepast puntenschema
- [ ] Klassement-weergave per competitietype (eclectic/strokeplay/OoM/week)

### 5.5 Rollen & rechten
- [ ] Elke rol ziet alleen toegestane menu-items
- [ ] Rechten-matrix wijzigen → effect direct zichtbaar
- [ ] Wedstrijdleider ziet leider-highlight op eigen wedstrijden
- [ ] Commissielid ziet standaard eigen commissie, kan naar "alle"

### 5.6 Commissies
- [ ] Commissie aanmaken met kleur
- [ ] Leden toevoegen/verwijderen
- [ ] Commissiekleur in kalender + filter in overzicht

### 5.7 Beheer & instellingen
- [ ] Gebruiker aanmaken/bewerken/verwijderen + wachtwoord
- [ ] Sponsoren aanmaken en koppelen
- [ ] Notificatie versturen
- [ ] Clubinstellingen wijzigen

---

## 6. Integratietests — datastromen (P2)

- [x] Form → app → DB → terug voor alle wizard-velden (roundtrip in `validate.js`)
- [ ] Nieuwe velden meenemen: tees, categorieen, special_holes, tiebreak, leeftijd, toelating_gs, qualifying
- [ ] Div-balans per view (voorkomt layout-/scoping-bugs)
- [ ] Supabase RLS: lezen lukt publiek, schrijven alleen ingelogd, audit_log insert werkt
- [ ] Offline → wijziging in localStorage queue → online → sync naar DB

---

## 7. Randgevallen & foutscenario's (P2)

- [ ] Lege wedstrijd (geen inschrijvingen) → geen crash op leaderboard/flights
- [ ] Speler zonder handicap → veilige default, geen NaN
- [ ] Wedstrijd zonder tees/categorieën → één gecombineerd klassement (fallback)
- [ ] Dubbele inschrijving → genegeerd, geen dubbele rij
- [ ] Score buiten bereik (0, negatief, 99) → afgevangen
- [ ] Twee browsers tegelijk scores invoeren → laatste wint, geen dataverlies
- [ ] Netwerk valt weg tijdens opslaan → nette melding, geen halve data
- [ ] Verkeerde kolomnaam / ontbrekende DB-kolom → duidelijke fout, niet stil falen

---

## 8. Platform & PWA (P4)

- [ ] App installeerbaar op telefoon (PWA)
- [ ] Offline: scorekaart invoerbaar, amber banner zichtbaar
- [ ] Online terug → wachtrij synchroniseert automatisch
- [ ] Live leaderboard update realtime op tweede apparaat
- [ ] Werkt op mobiel formaat (responsive)

---

## 9. Geautomatiseerde uitbreiding — concreet plan

De bestaande `tests/test-engines.js` dekt 6 van de 20 vormen. Uitbreiden in deze volgorde:

1. **Afronden fundament** — speelhandicap-randgevallen (negatief, 54, 9-holes IN/UIT), ESC-varianten.
2. **Ontbrekende individuele vormen** — Modified Stableford, Bogey, Par, Matchplay, Skins, Vlaggenwedstrijd, Shoot-out, Rabbit, Order of Merit. Elk met de standaard basisscenario's uit sectie 3.
3. **Teamvormen** — Texas Scramble, Fourball, Greensome, Foursomes, Alliance, Team Stableford, Chapman.
4. **Tiebreak-varianten** — matching/loting/laagste-hcp/delen.

Per vorm: minimaal 4-6 testcases (perfecte ronde, met handicap, leeg, incompleet, randgeval). Doel: van 104 naar ~250+ tests.

**Werkwijze:** elke testcase is een vaste input (scorekaart + speler + baan) met een handmatig nagerekende verwachte uitkomst. Die verwachte uitkomsten zijn meteen de specificatie voor de Laravel-herbouw — daar moeten exact dezelfde getallen uitkomen.

---

## 10. Voortgang bijhouden

Gebruik de Excel-tracker (`ScoreFlow-Functie-Tracker.xlsx`) parallel aan dit plan:
- Per functie de status: Werkt / Te testen / Bug / In ontwikkeling.
- Dit testplan = het *hoe*; de tracker = het *overzicht* van *wat* af is.

**Eindcriterium "top getest":**
- Alle 20 scoring-engines: groene unit-tests met de scenario's uit sectie 3.
- Alle flows uit sectie 5: minimaal één keer handmatig doorlopen en afgevinkt.
- Alle randgevallen uit sectie 7: gecontroleerd.
- Tracker: geen enkele P1/P2-functie meer op "Te testen".

---

*Dit testplan hoort bij `FUNCTIELIJST.md` (wat de app doet) en de Excel-tracker (status per functie). Samen vormen ze de specificatie voor de Laravel-herbouw.*
