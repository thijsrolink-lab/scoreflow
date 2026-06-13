# ScoreFlow — Functielijst

Een gedetailleerd overzicht van wat ScoreFlow functioneel kan. Geordend per module, vanuit het perspectief van wat de gebruiker (admin, wedstrijdleider, speler) kan doen. Bedoeld als naslagwerk, overdrachtsdocument en basis voor de roadmap.

---

## 1. Toegang & rollen

ScoreFlow kent drie beheerrollen met elk een eigen rechtenset, plus de speler.

- **Admin** — volledige toegang tot alle modules en instellingen.
- **Wedstrijdleider** — gericht op uitvoering: wedstrijden leiden, scores verwerken, flights beheren.
- **Wedstrijdplanner** — gericht op plannen: agenda, wedstrijden aanmaken en inplannen.
- **Speler** — eigen portaal: inschrijven, scores invoeren, leaderboard volgen.

Functies:
- Inloggen met e-mail en wachtwoord.
- Rechten per rol zijn aanpasbaar via een checkbox-matrix (welke rol bij welke module mag).
- Gebruikers worden automatisch naar het juiste portaal geleid (beheer of speler) op basis van hun rol.
- Rolnamen van oudere accounts worden automatisch omgezet naar de huidige rolstructuur.

---

## 2. Dashboard & overzicht

- **Dashboard** met de belangrijkste cijfers en aankomende wedstrijden in één oogopslag.
- **Mijn taken** — een actiegerichte takenlijst die per wedstrijd automatisch signaleert wat er nog moet gebeuren:
  - Wedstrijd is nog concept (klaar om te publiceren).
  - Geen wedstrijdleider gekoppeld (laag bij concept, hoog zodra gepubliceerd).
  - Nog geen inschrijvingen.
  - Spelers op de wachtlijst.
  - Flights nog niet ingedeeld terwijl er inschrijvingen zijn.
  - Wedstrijd start binnenkort maar is nog niet live gezet.
  - Spelers zonder ingevoerde scores tijdens een live wedstrijd.
  - Alle scores binnen → klaar om af te ronden.
  - Afgelaste wedstrijd die geheractiveerd kan worden.
- Taken zijn geprioriteerd (hoog / normaal / laag) en het aantal hoog-prioriteit taken verschijnt als badge in het menu.

---

## 3. Wedstrijden

### 3.1 Wedstrijd aanmaken (6-staps wizard)

**Stap 1 — Wedstrijd**
- Naam, datum, golfbaan, starttijd.
- Wedstrijdvorm kiezen uit een uitgebreide lijst (zie 3.4).
- Aantal rondes vrij invulbaar (1 voor een dagwedstrijd, meerdere voor bijv. een 72-holes kampioenschap).
- Holes per ronde (18 of 9, met keuze welke negen).
- Eén of meerdere **tees** toevoegen (kleur + label). Baandata zelf komt later via Golfspot.
- Koppeling aan een commissie.

**Stap 2 — Deelnemers**
- Maximaal aantal deelnemers en wachtlijstgedrag.
- Wedstrijdleider koppelen.
- Inschrijfperiode (open- en sluitingsdatum).
- Startgeld.
- Flexibele toelatingseisen: lidmaatschap, geslacht, speelsterkte (handicap-range van/tot) en leeftijd (van/tot).

**Stap 3 — Regels**
- Handicapverrekening (percentage).
- Qualifying / non-qualifying markering.
- Maximale score per hole (ESC-regeling).
- Uitslagbepaling bij gelijke stand: matching scorecards (laatste 9, 6, 3, 1), loting, laagste handicap, of plaats delen.

**Stap 4 — Uitslag**
- **Categorieën** definiëren binnen één wedstrijd, elk met een eigen klassement: op basis van geslacht, handicap-range en gekoppeld aan een tee. Scores worden één keer ingevoerd, het klassement wordt per categorie getoond.
- **Special holes** toevoegen (nearest to pin, longest drive, nearest to line, etc.) per hole, met handmatige winnaarinvoer.
- Prijzen vastleggen.

**Stap 5 — Sponsoren**
- Hoofdsponsor en co-sponsoren koppelen.
- Hole-sponsoren toewijzen.

**Stap 6 — Overzicht**
- Volledige samenvatting van de wedstrijd vóór publiceren, inclusief tees, categorieën en special holes.

### 3.2 Wedstrijd-levenscyclus

- Statussen: **concept → gepubliceerd → live → afgerond** (of afgelast).
- Wedstrijd publiceren (zichtbaar voor spelers, inschrijving open).
- Handmatig starten (scorekaart open voor invoer).
- Afronden (uitslag definitief).
- Afgelasten (met reden) en weer heractiveren.
- Bewerken in elke fase.
- Verwijderen.
- Elke statuswijziging wordt vastgelegd in de audit log.

### 3.3 Wedstrijdenoverzicht

- Alle wedstrijden in een lijst, gegroepeerd en gesorteerd op datum.
- Filteren op status (alle / aankomend / live / afgerond / concept).
- **Filteren op commissie** — commissieleden zien standaard hun eigen commissie, maar kunnen altijd alles tonen; admins zien altijd alles.
- Wedstrijden waarbij jij de leider bent worden gemarkeerd ("Jouw wedstrijd").
- Labels per wedstrijd: commissie, competitie (🏆), non-qualifying, en een waarschuwing (⚠️) bij openstaande taken.
- Meerdere wedstrijden selecteren en bundelen tot een competitie.
- Wedstrijd-templates: opslaan en hergebruiken van veelgebruikte wedstrijdopzetten.

### 3.4 Ondersteunde wedstrijdvormen

Individueel: Strokeplay, Stableford, Modified Stableford, Bogey competition, Par competition, Matchplay, Skins, Eclectic, Vlaggenwedstrijd, Shoot-out, Rabbit, Amerikaantje, Order of Merit.

Team: Texas Scramble, Shamble, Fourball, Greensome, Foursomes, Alliance, Team Stableford, Chapman.

Elke vorm heeft een eigen scoreberekening en een uitlegtekst ("Hoe werkt deze vorm?").

---

## 4. Kalender

- Maandweergave van alle geplande wedstrijden.
- Kleurcodering per commissie, met legenda.
- Klikbaar naar wedstrijddetail.
- AI-ondersteunde kalenderopbouw (zie 11).

---

## 5. Inschrijvingen

- Spelers inschrijven voor een wedstrijd (door admin of door speler zelf).
- Wachtlijstbeheer: spelers op de wachtlijst toelaten zodra er plek is.
- Afmelden.
- Overzicht van alle inschrijvingen per wedstrijd met status.
- Toelatingseisen worden gehanteerd op basis van de wedstrijdinstellingen.

---

## 6. Flights

- Flights (groepen) aanmaken voor een wedstrijd.
- Automatisch indelen van ingeschreven spelers.
- Spelers handmatig verplaatsen tussen flights.
- Flights verwijderen.
- Starttijden per flight.
- Basis voor de scorekaart-weergave tijdens het spelen.

---

## 7. Scores & live verwerking

- Scorekaart per speler, hole voor hole.
- Compacte score-invoertabel voor snelle verwerking.
- Score-invoer per flight.
- Teamscores voor de teamvormen.
- Live herberekening van het klassement bij elke ingevoerde score.
- Ondersteuning voor blind holes (holes die niet meetellen).
- Scores aanpassen en verwijderen.
- **Live leaderboard** — de kernfunctie, real-time bijgewerkt tijdens het spelen. Dit is volgens de pilot de meest gewaardeerde functie voor spelers in het veld.
- Apart leaderboard-scherm (`leaderboard.html`) voor weergave op een groot scherm.

---

## 8. Competities

Een competitie bundelt meerdere losse wedstrijden tot één gecombineerd klassement.

- Competitie aanmaken via een eigen wizard.
- **Rondes genereren**: startdatum + interval (wekelijks / tweewekelijks / maandelijks) + aantal, of handmatig toevoegen. Datum en starttijd per ronde aanpasbaar.
- De gegenereerde rondes worden als losse wedstrijden aangemaakt én automatisch aan de competitie gekoppeld.
- **Inschrijven op competitieniveau**: een speler schrijft zich één keer in en doet automatisch aan alle rondes mee. Zowel door de admin (deelnemers-tab) als door de speler zelf (spelersportaal).
- Afmelden van alle rondes tegelijk.
- Competitietypes met eigen klassementberekening: Eclectic, Strokeplay, Order of Merit, Week-competitie.
- **Order of Merit met aanpasbaar puntenschema**: punten per eindpositie per ronde, optellend over alle rondes. Standaardschema aanwezig, volledig aanpasbaar per competitie, inclusief deelnamepunten voor spelers buiten het schema.
- Competitie-overzicht toont per competitie alle gekoppelde rondes met datum, starttijd, deelnemers en status; klikbaar naar de losse wedstrijd.
- Klassement-weergave per competitie, inclusief breakdown per ronde.

---

## 9. Spelers & deelnemers

- **Clubleden**: ledenbeheer met profielgegevens (naam, handicap, geslacht, contactgegevens).
- Spelers aanmaken, bewerken, verwijderen.
- Wachtwoord instellen of wijzigen.
- **Deelnemers**: overzicht van wie aan welke wedstrijd deelneemt.

---

## 10. Inzichten

- **Rapportages**: overzichten en grafieken over wedstrijden en deelname.
- **Audit log**: volledige logging van beheeracties (wedstrijd aangemaakt/bewerkt/gestart/afgerond/afgelast/verwijderd, speler- en gebruikersmutaties, inschrijvingen toegelaten/afgemeld, commissie- en competitiewijzigingen). Kleurgecodeerd per actietype, met gebruiker, tijdstip, object en details. Entries worden automatisch na 30 dagen opgeruimd.
- **Ranking**: ranglijst over wedstrijden heen.

---

## 11. AI-assistent

- **AI-chat**: een ingebouwde assistent (op basis van Claude) die vragen over de club en wedstrijden beantwoordt.
- **AI-kalender**: automatisch een kalender met wedstrijdvoorstellen genereren uit een vrije tekstbeschrijving.
- Voorgestelde wedstrijden bekijken, bulk importeren of selectief verwijderen.
- Automatische kleurtoewijzing en dubbele-detectie bij het importeren.

---

## 12. Beheer

- **Gebruikers & rollen**: beheeraccounts, roltoewijzing en de rechten-matrix per rol.
- **Commissies**: commissies aanmaken met een eigen kleur, leden toevoegen/verwijderen. Commissies kleuren door in de kalender en filteren in het wedstrijdenoverzicht.
- **Notificaties**: berichten beheren en versturen.
- **Baaninformatie**: baangegevens vastleggen.
- **Sponsoren**: sponsorbeheer (naam, logo, website, contact, bedrag) en koppeling aan wedstrijden.

---

## 13. Instellingen

- Clubinstellingen (clubnaam, weergave).
- Persoonlijke voorkeuren per gebruiker.

---

## 14. Spelersportaal

Het portaal voor leden, los van het beheer:

- **Kalender**: aankomende wedstrijden bekijken.
- **Inschrijvingen**: zelf in- en uitschrijven, eigen inschrijvingen beheren.
- **Competities**: actieve competities bekijken en zich in één klik inschrijven voor alle rondes; per ronde zichtbaar of je meedoet.
- **Scores / uitslagen**: eigen scores en uitslagen inzien.
- **Profiel**: eigen gegevens beheren.
- **Live leaderboard** volgen tijdens het spelen.

---

## 15. Techniek & platform

- **Progressive Web App (PWA)**: installeerbaar op telefoon/tablet/desktop.
- **Offline score-invoer**: scores worden lokaal in een wachtrij gezet bij geen verbinding en automatisch gesynchroniseerd zodra de verbinding terug is, met een duidelijke offline-indicator.
- **Realtime updates** voor het live leaderboard.
- Volledig Nederlandstalige interface en golf-terminologie.

---

## 16. Op de roadmap (nog niet of gedeeltelijk gebouwd)

- **Golfspot-koppeling**: tees, baandata en handicap-verwerking via Golfspot; qualifying scores doorsturen naar het handicapsysteem. ScoreFlow doet bewust géén eigen handicapberekening.
- **Leaderboard per categorie** renderen (categorieën zijn al definieerbaar in de wizard).
- **Special holes**: winnaarregistratie en weergave verder uitwerken.
- **Vereenvoudigde leaderboard-weergave** voor spelers (huidige toont veel informatie tegelijk).
- **Mollie-betaalintegratie** voor inschrijfgeld (gepland na bedrijfsregistratie).
- **Meertaligheid** (admin-interface, per gebruiker — infrastructuur besproken, nog niet gebouwd).
- **Landingspagina** voor het product (Tournament / "powered by Golfspot").

---

*Dit document beschrijft de functionele staat van ScoreFlow. Voor de technische opzet en overdracht, zie `OVERDRACHT.md`. Voor de database, zie `MIGRATIES.sql`.*
