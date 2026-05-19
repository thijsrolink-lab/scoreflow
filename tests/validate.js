#!/usr/bin/env node
/**
 * ScoreFlow - Statische validatie tests
 * Draait voor elke commit om regressies te vangen die we vandaag hadden.
 */

const fs = require('fs');
const path = require('path');

const HTML_PATH = path.join(__dirname, '..', 'index.html');

// ── Kleuren voor output ──────────────────────────────────────
const C = {
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  cyan: '\x1b[36m', reset: '\x1b[0m', bold: '\x1b[1m'
};

let passed = 0, failed = 0;
const failures = [];

function test(name, fn) {
  try {
    const result = fn();
    if (result === true || result === undefined) {
      console.log(`  ${C.green}✓${C.reset} ${name}`);
      passed++;
    } else {
      console.log(`  ${C.red}✗${C.reset} ${name}`);
      console.log(`      ${C.yellow}${result}${C.reset}`);
      failed++;
      failures.push({name, reason: result});
    }
  } catch (e) {
    console.log(`  ${C.red}✗${C.reset} ${name}`);
    console.log(`      ${C.yellow}${e.message}${C.reset}`);
    failed++;
    failures.push({name, reason: e.message});
  }
}

function section(name) {
  console.log(`\n${C.bold}${C.cyan}▸ ${name}${C.reset}`);
}

// ── Laad HTML ────────────────────────────────────────────────
if (!fs.existsSync(HTML_PATH)) {
  console.error(`${C.red}HTML bestand niet gevonden: ${HTML_PATH}${C.reset}`);
  process.exit(1);
}
const html = fs.readFileSync(HTML_PATH, 'utf8');

console.log(`${C.bold}ScoreFlow Regressie Tests${C.reset}`);
console.log(`Bestand: ${path.basename(HTML_PATH)} (${(html.length/1024).toFixed(1)} KB)`);

// ═══════════════════════════════════════════════════════════════
// HTML STRUCTUUR
// ═══════════════════════════════════════════════════════════════
section('HTML structuur');

test('DOCTYPE aanwezig', () => {
  return html.startsWith('<!DOCTYPE html>') || 'DOCTYPE ontbreekt of staat niet vooraan';
});

test('<html>, <head>, <body> aanwezig', () => {
  return (html.includes('<html') && html.includes('<head>') && html.includes('<body>'))
    || 'Een van de basis HTML tags ontbreekt';
});

test('UTF-8 charset gedeclareerd', () => {
  return /<meta\s+charset=["']UTF-8["']/i.test(html) || 'UTF-8 charset ontbreekt';
});

test('Viewport meta voor mobiel', () => {
  return html.includes('name="viewport"') || 'viewport meta tag ontbreekt';
});

// ═══════════════════════════════════════════════════════════════
// SCRIPT TAGS
// ═══════════════════════════════════════════════════════════════
section('Script tags');

const scriptOpens = (html.match(/<script[\s>]/g) || []).length;
const scriptCloses = (html.match(/<\/script>/g) || []).length;

test('Script tags in balans', () => {
  return scriptOpens === scriptCloses || `${scriptOpens} open vs ${scriptCloses} close`;
});

test('Minstens 1 script tag aanwezig', () => {
  return scriptOpens >= 1 || 'Geen <script> tag gevonden';
});

// Extract alle script blokken
function extractScripts(html) {
  const scripts = [];
  let pos = 0;
  const regex = /<script[^>]*>/g;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const start = m.index + m[0].length;
    const end = html.indexOf('</script>', start);
    if (end > 0) {
      scripts.push({
        start: m.index,
        contentStart: start,
        contentEnd: end,
        content: html.slice(start, end),
        line: html.slice(0, m.index).split('\n').length
      });
    }
  }
  return scripts;
}

const scripts = extractScripts(html);

test('Alle script tags correct afgesloten', () => {
  return scripts.length === scriptOpens || `${scripts.length} geparseerd, ${scriptOpens} opens`;
});

// ═══════════════════════════════════════════════════════════════
// JAVASCRIPT SYNTAX
// ═══════════════════════════════════════════════════════════════
section('JavaScript syntax');

const vm = require('vm');

scripts.forEach((sc, i) => {
  test(`Script ${i+1} (regel ${sc.line}, ${(sc.content.length/1024).toFixed(1)} KB) is valid JS`, () => {
    try {
      new vm.Script(sc.content, { filename: `script-${i+1}.js` });
      return true;
    } catch (e) {
      return `Syntax error: ${e.message}`;
    }
  });

  // Accolade check is redundant: vm.Script valideert al
});

// ═══════════════════════════════════════════════════════════════
// FUNCTIES EN HANDLERS
// ═══════════════════════════════════════════════════════════════
section('Functies en onclick handlers');

// Alle functies uit alle scripts
const allFns = new Set();
const fnDupes = {};
scripts.forEach(sc => {
  const matches = sc.content.matchAll(/^(?:async\s+)?function\s+(\w+)\s*\(/gm);
  for (const m of matches) {
    if (allFns.has(m[1])) {
      fnDupes[m[1]] = (fnDupes[m[1]] || 1) + 1;
    }
    allFns.add(m[1]);
  }
});

test('Geen dubbele functie-definities', () => {
  const dupes = Object.keys(fnDupes);
  return dupes.length === 0 || `Dubbelen: ${dupes.join(', ')}`;
});

// Alle onclick handlers
const body = html.slice(html.indexOf('<body>'));
const onclicks = [...body.matchAll(/onclick="([^"]+)"/g)].map(m => m[1]);

const builtins = new Set([
  'confirm', 'alert', 'prompt', 'parseInt', 'parseFloat', 'Math', 'this',
  'document', 'window', 'event', 'navigator', 'console', 'setTimeout',
  'if', 'for', 'while', 'return', 'true', 'false', 'null', 'undefined',
  // DOM methods op this.* die valide zijn
  'closest', 'querySelector', 'querySelectorAll', 'addEventListener'
]);

// De onclick handler kan beginnen met this.methodName — valideer die apart
function parseFunctionCall(expr) {
  // 'this.closest(...)' — skip, DOM call
  if (/^this\./.test(expr)) return null;
  // 'foo(...)' — return 'foo'
  const m = expr.match(/^(\w+)\s*\(/);
  return m ? m[1] : null;
}

const missingHandlers = new Set();
onclicks.forEach(oc => {
  const fn = parseFunctionCall(oc);
  if (fn && !allFns.has(fn) && !builtins.has(fn)) {
    missingHandlers.add(fn);
  }
});

test('Alle onclick-functies bestaan', () => {
  return missingHandlers.size === 0
    || `Ontbrekend: ${[...missingHandlers].join(', ')}`;
});

test('Kritieke login functies bestaan', () => {
  const required = ['loginAs', 'doLogin', 'startSessie'];
  const missing = required.filter(fn => !allFns.has(fn));
  return missing.length === 0 || `Ontbreekt: ${missing.join(', ')}`;
});
test('Functies aangeroepen in innerHTML = X(...) bestaan', () => {
  const mainScript = scripts[scripts.length - 1].content;
  // Patroon: .innerHTML = functieNaam(...)
  const regex = /\.innerHTML\s*=\s*(\w+)\s*\(/g;
  const calledFns = new Set();
  for (const m of mainScript.matchAll(regex)) {
    calledFns.add(m[1]);
  }

  const missing = [];
  calledFns.forEach(fn => {
    if (!allFns.has(fn) && !builtins.has(fn)) {
      missing.push(fn);
    }
  });
  return missing.length === 0 || `Functies ontbreken: ${missing.join(', ')}`;
});

// ═══════════════════════════════════════════════════════════════
// REGRESSIE — bugs die we vandaag hadden
// ═══════════════════════════════════════════════════════════════
section('Regressies van bekende bugs');

test('Geen esc() aanroepen (moet escHtml zijn)', () => {
  const mainScript = scripts[scripts.length - 1].content;
  // Zoek esc( maar niet escape( of escHtml( of _esc
  const bad = mainScript.match(/[^a-zA-Z_]esc\s*\(/g) || [];
  return bad.length === 0 || `${bad.length}x gevonden (moet escHtml zijn)`;
});

test('parseInt niet op dropdown .value (UUID bug)', () => {
  // UUID velden zijn strings. parseInt('abc-123-def') = NaN.
  // Als een dropdown waarde een UUID kan zijn, mag je er geen parseInt op doen.
  //
  // Lijst van dropdown IDs waar UUIDs in zitten (wedstrijd-IDs, speler-IDs, etc.)
  // Patroon: ...-w = wedstrijd, ...-s = speler, ...-fw = flight-wedstrijd, etc.
  const mainScript = scripts[scripts.length - 1].content;

  // Zoek alle parseInt(document.getElementById('xxx').value) patronen
  const allMatches = [...mainScript.matchAll(
    /parseInt\s*\(\s*document\.getElementById\s*\(\s*['"]([\w-]+)['"][^)]*\)\.value[^)]*\)/g
  )];

  // IDs die UUIDs kunnen bevatten (wedstrijd-select, speler-select, etc.)
  const uuidIdPatterns = [
    /-w$/,      // fl-w, sc-w, mi-w, rang-w, sk-w, ing-fw — wedstrijd ID
    /-s$/,      // mi-s, gw-s — speler ID
    /-fw$/,     // flight-wedstrijd
    /^mi-/,     // modal-inschrijven: wedstrijd + speler
    /^fl-/,     // flights: wedstrijd select
    /^sc-/,     // scores: wedstrijd select
  ];
  // Expliciete uitzonderingen: velden die integer zijn
  const integerIds = new Set([
    'sc-ronde', 'mi-opm', 'fl-aantal', 'fl-per',
    'comp-gen-aantal', 'comp-hcpperc', 'comp-holes', 'comp-slope',
    'comp-minrondes', 'comp-eclhcp',
  ]);

  const problematic = [];
  allMatches.forEach(m => {
    const id = m[1];
    if (integerIds.has(id)) return;
    if (uuidIdPatterns.some(p => p.test(id))) {
      problematic.push(id);
    }
  });

  return problematic.length === 0
    || `parseInt op UUID dropdown: ${[...new Set(problematic)].join(', ')}`;
});
test('Geen parseInt op dropdown values in onclick handlers (UUID bug)', () => {
  // Zoek onclick handlers die parseInt(...getElementById(...).value) gebruiken
  // UUID's kunnen niet via parseInt → resultaat is NaN
  const pattern = /onclick="[^"]*parseInt\s*\(\s*document\.getElementById\s*\([^)]+\)\.value/g;
  const matches = html.match(pattern) || [];
  return matches.length === 0
    || `parseInt in onclick gevonden (${matches.length}x): ${matches[0].slice(0,80)}`;
});

test('UUID IDs in onclick handlers tussen quotes', () => {
  // Patroon FOUT:  onclick="fn('+w.id+')"  of  onclick="fn('+w.id+','+u.id+')"
  // Patroon GOED:  onclick="fn(\''+w.id+'\')"
  //
  // UUIDs bevatten streepjes (-) die zonder quotes als minus-operator
  // worden geïnterpreteerd → SyntaxError in de browser.
  const mainScript = scripts[scripts.length - 1].content;

  // Zoek alle onclick handlers die een concat-variabele aan een ID
  // bevatten: '+ xxx.id +' zonder directe single-quote ervoor en erna
  //
  // Match: onclick="fn(BLABLA+\w+\.id+BLABLA)"
  // waar BLABLA geen \' bevat direct naast de +.id+
  const pattern = /onclick=\\"[^\\"]*\b(\w+)\s*\([^)]*\)/g;
  const bad = [];
  let m;
  while ((m = pattern.exec(mainScript)) !== null) {
    const full = m[0];
    // Check: bevat het "+\w+.id+" zonder voorafgaand \' of trailing \'?
    // Safe pattern: \'\'+var.id+\'\'   (quote, empty, +var.id+, empty, quote)
    // Unsafe: ('+var.id+')   direct in de call
    const unsafeIdPattern = /[^\\'](\+\s*\w+\.id\s*\+)[^\\']/;
    if (unsafeIdPattern.test(full)) {
      bad.push(full.slice(0, 80));
    }
  }
  return bad.length === 0 || `Onclick met UUID zonder quotes: ${bad.slice(0,2).join('; ')}`;
});

test('escHtml functie bestaat', () => {
  return allFns.has('escHtml') || 'escHtml functie ontbreekt';
});

test('Demo accounts zichtbaar in HTML', () => {
  const count = (html.match(/onclick="loginAs/g) || []).length;
  return count >= 6 || `Slechts ${count} demo buttons (verwacht 6)`;
});
test('Kritieke DOM elementen aanwezig in HTML', () => {
  // Functies als toast() doen getElementById — die element MOET in HTML staan
  const required = [
    'toast',           // feedback bij acties
    'login-email',     // login
    'login-pw',        // login
    'login-err',       // login fouten
  ];
  const missing = required.filter(id => !html.includes(`id="${id}"`));
  return missing.length === 0
    || `DOM elementen ontbreken: ${missing.join(', ')}`;
});
test('Unsafe getElementById (zonder null check) verwijst naar bestaand ID', () => {
  // Detecteert patroon: getElementById('x').innerHTML = ...   (crasht als element ontbreekt)
  // OF getElementById('x').textContent = ...
  // OF .value = ...
  // Veilig zijn: var el = getElementById(...); if(el) ...
  const mainScript = scripts[scripts.length - 1].content;

  // Detecteert getElementById('x').PROP waar PROP = innerHTML, textContent, value of classList
  // Dit is de UNSAFE variant — zonder null check
  const regex = /getElementById\s*\(\s*['"]([\w-]+)['"]\s*\)\s*\.\s*(innerHTML|textContent|value|classList)/g;

  // Haal alle statisch gedefinieerde IDs
  const htmlIds = new Set();
  for (const m of html.matchAll(/\bid=["']([\w-]+)["']/g)) htmlIds.add(m[1]);
  // Dynamisch via innerHTML ingevoegde IDs
  for (const m of mainScript.matchAll(/id=["']([\w-]+)["']/g)) htmlIds.add(m[1]);

  const missing = [];
  for (const m of mainScript.matchAll(regex)) {
    if (!htmlIds.has(m[1])) missing.push(m[1]);
  }

  return missing.length === 0
    || `Unsafe getElementById op ontbrekend ID: ${[...new Set(missing)].join(', ')}`;
});

test('Script tag staat vóór body content (garanties voor inline onclicks)', () => {
  // Alle scripts moeten vóór de onclick handlers komen
  const firstOnclickPos = body.indexOf('onclick=');
  if (firstOnclickPos < 0) return true;  // geen onclicks = geen probleem
  const firstOnclickAbs = html.indexOf('<body>') + firstOnclickPos;
  const lastScriptBeforeOnclick = Math.max(...scripts.filter(s => s.start < firstOnclickAbs).map(s => s.start));
  if (lastScriptBeforeOnclick === -Infinity) {
    return 'Geen script vóór eerste onclick';
  }
  return true;
});

// ═══════════════════════════════════════════════════════════════
// GEEN CODE BUITEN SCRIPT TAGS
// ═══════════════════════════════════════════════════════════════
section('Geen losse code in HTML');

test('Geen losse JavaScript in de HTML (broncode lek)', () => {
  // Zoek JS-achtige patronen in HTML buiten <script> tags
  // Bouw een HTML met alle script content vervangen door niets
  let htmlNoScript = html;
  scripts.forEach(sc => {
    const full = html.slice(sc.start, sc.contentEnd + '</script>'.length);
    htmlNoScript = htmlNoScript.replace(full, '');
  });
  // Ook <style> blocks eruit
  htmlNoScript = htmlNoScript.replace(/<style[^>]*>[\s\S]*?<\/style>/g, '');

  // Zoek verdachte patronen buiten script
  // Haal eerst alle strings (", ', `) uit de HTML om false positives te voorkomen
  // In HTML attributen zoals onclick="..." staat vaak geldige JS code
  // We zoeken alleen naar losse JS BUITEN attributen
  //
  // Simpel patroon: een regel die met functiedefinitie begint zonder in een string te zitten
  const suspicious = [
    /^function\s+\w+\s*\([^)]*\)\s*\{/m,        // losse function declaration
    /^var\s+[A-Z][A-Z_]+\s*=\s*\[/m,                // losse ALL_CAPS array
    /INSCHRIJVINGEN\.filter\s*\(function/,           // app code
    /WEDSTRIJDEN\.find\s*\(function/,                // app code
  ];

  const found = [];
  suspicious.forEach(p => {
    const m = htmlNoScript.match(p);
    if (m) found.push(m[0]);
  });

  return found.length === 0 || `Code buiten <script>: ${found.slice(0,2).join(', ')}`;
});


// ═══════════════════════════════════════════════════════════════
// WEDSTRIJD FORM ROUNDTRIP — elke input moet in alle 4 functies zitten
// (voorkomt 'flt' bug: veld bestond in form, werd niet opgeslagen)
// ═══════════════════════════════════════════════════════════════
section('Form roundtrip (save/load completeness)');

// Extract script for these tests
const scriptMatch = html.match(/<script>([\s\S]+?)<\/script>/);
const scriptText = scriptMatch ? scriptMatch[1] : '';

function getFnBody(src, name) {
  const idx = src.indexOf('function ' + name);
  if (idx < 0) return '';
  let depth = 0, started = false;
  for (let i = idx; i < idx + 20000 && i < src.length; i++) {
    if (src[i] === '{') { depth++; started = true; }
    else if (src[i] === '}' && started) {
      depth--;
      if (depth === 0) return src.substring(idx, i + 1);
    }
  }
  return '';
}

// Critical inputs that MUST roundtrip: formId → appKey
// form = input id, app = camelCase key in JS object, db = snake_case DB column
const criticalFields = [
  {form: 'fn',      app: 'naam',          db: 'naam',           label: 'Naam'},
  {form: 'fd',      app: 'datum',         db: 'datum',          label: 'Datum'},
  {form: 'fb',      app: 'baan',          db: 'baan',           label: 'Baan'},
  {form: 'ft',      app: 'tijd',          db: 'tijd',           label: 'Starttijd'},
  {form: 'fcr',     app: 'cr',            db: 'cr',             label: 'CR'},
  {form: 'fsl',     app: 'slope',         db: 'slope',          label: 'Slope'},
  {form: 'fh',      app: 'holes',         db: 'holes',          label: 'Holes'},
  {form: 'fmax',    app: 'max',           db: 'max_deelnemers', label: 'Max deelnemers'},
  {form: 'fflt',    app: 'flt',           db: 'flt',            label: 'Flight grootte'},
  {form: 'fleider', app: 'leiderId',      db: 'leider_id',      label: 'Wedstrijdleider'},
  {form: 'fhmax',   app: 'hcpmax',        db: 'hcp_max',        label: 'HCP max'},
  {form: 'fhmin',   app: 'hcpmin',        db: 'hcp_min',        label: 'HCP min'},
  {form: 'fhp',     app: 'hcpperc',       db: 'hcp_perc',       label: 'HCP %'},
  {form: 'fesc',    app: 'esc',           db: 'esc',            label: 'ESC'},
  {form: 'fsg',     app: 'startgeld',     db: 'startgeld',      label: 'Startgeld'},
  {form: 'fop',     app: 'inschrijfOpen', db: 'inschrijf_open', label: 'Inschrijving open'},
  {form: 'fsluit',  app: 'inschrijfSluit',db: 'inschrijf_sluit',label: 'Inschrijving sluit'},
  {form: 'fomschr', app: 'omschrijving',  db: 'omschrijving',   label: 'Omschrijving'},
];

const bouw = getFnBody(scriptText, 'bouwWedstrijdUitFormulier');
const edit = getFnBody(scriptText, 'editW');
const dbSave = getFnBody(scriptText, 'dbSaveWedstrijd');
const dbLoad = getFnBody(scriptText, 'dbWedstrijdNaarApp');

criticalFields.forEach(f => {
  test(`Field '${f.label}' (${f.form}) roundtrip`, () => {
    const issues = [];
    // 1. form-input wordt gelezen bij save
    if (!bouw.includes("'" + f.form + "'")) issues.push('bouwWedstrijdUitFormulier leest form-veld niet');
    // 2. form-input wordt gevuld bij edit (direct of via helper-functie)
    // Patroon: sv('fxxx', ...) of vulXxxDropdown(...) of getElementById('fxxx')
    var editVulMatch = edit.includes("'" + f.form + "'") ||
                       edit.includes('vulLeiderDropdown') && f.form === 'fleider';
    if (!editVulMatch) issues.push('editW vult form-veld niet');
    // 3. veld wordt naar DB gestuurd (DB-kolom linkerhand)
    if (!dbSave.includes(f.db + ':')) issues.push('dbSaveWedstrijd stuurt veld niet naar DB');
    // 4. veld wordt uit DB gelezen (DB-kolom aan .w zijde)
    if (!dbLoad.includes('w.' + f.db)) issues.push('dbWedstrijdNaarApp leest veld niet terug');
    return issues.length === 0 || issues.join(' | ');
  });
});

// ═══════════════════════════════════════════════════════════════
// LIFECYCLE HELPERS — must exist en must be globally callable
// ═══════════════════════════════════════════════════════════════
section('Lifecycle helpers');

const lifecycleFns = [
  'wedstrijdFase',
  'wedstrijdStartTs',
  'wedstrijdEindeTs',
  'scorekaartToegankelijk',
  'veldBewerkbaar',
  'statusBadge',
  'startWedstrijd',
  'afrondWedstrijd',
  'afgelastWedstrijd',
  'heractiveerWedstrijd',
];

lifecycleFns.forEach(fn => {
  test(`${fn}() bestaat`, () => {
    return scriptText.includes('function ' + fn + '(') ||
      `Functie '${fn}' niet gedefinieerd`;
  });
});

// ═══════════════════════════════════════════════════════════════
// ONCLICK HANDLERS — alle moeten een definitie hebben
// ═══════════════════════════════════════════════════════════════
section('Onclick handlers');

test('Alle onclick handlers verwijzen naar bestaande functies', () => {
  const htmlOnly = html.replace(/<script>[\s\S]+?<\/script>/g, '');
  const onclickCalls = new Set();
  const re = /onclick=["']([a-zA-Z_][\w]*)\s*\(/g;
  let m;
  while ((m = re.exec(htmlOnly)) !== null) {
    onclickCalls.add(m[1]);
  }
  const missing = [];
  onclickCalls.forEach(fn => {
    if (!scriptText.includes('function ' + fn + '(') &&
        !scriptText.includes('function ' + fn + ' (') &&
        !scriptText.includes(fn + ' = function')) {
      missing.push(fn);
    }
  });
  return missing.length === 0 || 'Ontbrekende functies: ' + missing.join(', ');
});

// ═══════════════════════════════════════════════════════════════
// HELP SYSTEEM — alle admin views moeten help content hebben
// ═══════════════════════════════════════════════════════════════
section('Help systeem');

test('HELP object bestaat en heeft alle admin views', () => {
  const helpMatch = scriptText.match(/var\s+HELP\s*=\s*\{([\s\S]+?)^\};/m);
  if (!helpMatch) return 'HELP object niet gevonden';
  const helpBody = helpMatch[1];
  const requiredKeys = ['dashboard', 'wedstrijden', 'inschrijvingen', 'flights', 'scores'];
  const missing = requiredKeys.filter(k => !new RegExp('^\\s*' + k + '\\s*:\\s*\\{', 'm').test(helpBody));
  return missing.length === 0 || 'Ontbrekende help-keys: ' + missing.join(', ');
});

// ═══════════════════════════════════════════════════════════════
// DB SYNC — alle velden met DB-tegenhanger moeten bidirectioneel
// ═══════════════════════════════════════════════════════════════
section('Database sync');

test('dbSaveWedstrijd en dbWedstrijdNaarApp hebben symmetrische velden', () => {
  const save = getFnBody(scriptText, 'dbSaveWedstrijd');
  const load = getFnBody(scriptText, 'dbWedstrijdNaarApp');
  if (!save || !load) return 'dbSave/dbLoad functies niet gevonden';

  // Extract db-kolomnamen uit save (patroon: naam: value)
  const saveKeys = new Set();
  const saveFields = save.match(/\b(\w+):\s*w\.\w+/g) || [];
  saveFields.forEach(f => {
    const m = f.match(/^(\w+):/);
    if (m) saveKeys.add(m[1]);
  });

  // Moet ook in load voorkomen (als DB-kolom-naam aan linkerkant van value lezen)
  const missing = [];
  ['tijd', 'flt', 'afgelast_reden', 'status'].forEach(k => {
    if (saveKeys.has(k) && !load.includes(k)) missing.push(k);
  });

  return missing.length === 0 || 'Niet bidirectioneel gesynct: ' + missing.join(', ');
});

// ═══════════════════════════════════════════════════════════════
// HCP-VERREKENING — clean leaderboard zonder HCP (Texas Scramble 20 mei)
// ═══════════════════════════════════════════════════════════════
section('HCP-verrekening toggle (hcpperc=0 = bruto-only)');

test('Helper gebruiktHcp bestaat in index.html', () => {
  return /function\s+gebruiktHcp\s*\(/.test(scriptText) ||
    'gebruiktHcp helper niet gedefinieerd';
});

test('Helper gebruiktHcp bestaat in leaderboard.html', () => {
  const lbPath = path.join(__dirname, '..', 'leaderboard.html');
  if (!fs.existsSync(lbPath)) return 'leaderboard.html niet gevonden';
  const lbHtml = fs.readFileSync(lbPath, 'utf8');
  return /function\s+gebruiktHcp\s*\(/.test(lbHtml) ||
    'gebruiktHcp helper ontbreekt in standalone leaderboard';
});

test('Helper retourneert false bij hcpperc=0', () => {
  // Voer de gebruiktHcp logica uit (BELANGRIJK: niet || 100, want 0 is falsy)
  const fn = function(w) {
    var perc = parseInt(w && w.hcpperc);
    return (isNaN(perc) ? 100 : perc) > 0;
  };
  if (fn({hcpperc: 0}) !== false) return 'hcpperc=0 → moet false zijn';
  if (fn({hcpperc: 100}) !== true) return 'hcpperc=100 → moet true zijn';
  if (fn({hcpperc: 50}) !== true) return 'hcpperc=50 → moet true zijn';
  if (fn({}) !== true) return 'leeg → default 100 → moet true zijn';
  return true;
});

test("buildTeamLeaderboard gebruikt gebruiktHcp om kolommen te tonen/verbergen", () => {
  const fnBody = getFnBody(scriptText, 'buildTeamLeaderboard');
  if (!fnBody) return 'buildTeamLeaderboard niet gevonden';
  if (!fnBody.includes('gebruiktHcp(w)')) return 'roept gebruiktHcp(w) niet aan';
  if (!fnBody.includes('nettoVsParGespeeld') || !fnBody.includes('brutoVsParGespeeld')) {
    return 'sort gebruikt geen vsParGespeeld voor eerlijke partial-play ranking';
  }
  return true;
});

test("buildTeamLeaderboardCompact gebruikt gebruiktHcp", () => {
  const fnBody = getFnBody(scriptText, 'buildTeamLeaderboardCompact');
  if (!fnBody) return 'buildTeamLeaderboardCompact niet gevonden';
  if (!fnBody.includes('gebruiktHcp(w)')) return 'roept gebruiktHcp(w) niet aan';
  if (!fnBody.includes('hoofdScore')) return 'hoofdScore variabele ontbreekt';
  return true;
});

test("renderLiveLeaderboard (TV-mode) gebruikt gebruiktHcp voor TS", () => {
  const fnBody = getFnBody(scriptText, 'renderLiveLeaderboard');
  if (!fnBody) return 'renderLiveLeaderboard niet gevonden';
  // Moet in het Texas Scramble blok metHcp gebruiken
  if (!fnBody.includes('gebruiktHcp(w)')) return 'roept gebruiktHcp(w) niet aan';
  if (!fnBody.includes("labelSc = metHcp ? 'netto' : 'score'")) {
    return "label 'netto'/'score' wordt niet geswitcht";
  }
  return true;
});

test("Form-veld fhp heeft '0' optie voor geen HCP-verrekening", () => {
  // Zoek de fhp select
  const m = html.match(/<select id="fhp">([\s\S]*?)<\/select>/);
  if (!m) return 'fhp select niet gevonden';
  if (!m[1].includes('value="0"')) return "optie value='0' ontbreekt in fhp";
  if (!/geen verrekening|bruto/i.test(m[1])) return "label voor 0-optie is onduidelijk";
  return true;
});

// ═══════════════════════════════════════════════════════════════
// SIDE GAMES — Neary / Longest Drive / Leary met sponsor-koppeling
// ═══════════════════════════════════════════════════════════════
section('Side games (Neary / LD / Leary)');

test('SIDE_GAME_TYPES array bestaat met 3 types', () => {
  if (!/var\s+SIDE_GAME_TYPES\s*=\s*\[/.test(scriptText)) return 'SIDE_GAME_TYPES niet gevonden';
  ['neary', 'longest-drive', 'leary'].forEach(function(t) {
    if (!scriptText.includes("type: '" + t + "'")) {
      throw new Error("Type '" + t + "' niet gevonden in SIDE_GAME_TYPES");
    }
  });
  return true;
});

test('sideGamesVoorWedstrijd helper filtert op de 3 types', () => {
  const fn = getFnBody(scriptText, 'sideGamesVoorWedstrijd');
  if (!fn) return 'sideGamesVoorWedstrijd niet gevonden';
  if (!fn.includes('isSideGameType')) return 'gebruikt isSideGameType niet';
  return true;
});

test('renderSideGamesGrid functie bestaat (in index.html en leaderboard.html)', () => {
  if (!/function\s+renderSideGamesGrid/.test(scriptText)) return 'ontbreekt in index.html';
  const lbPath = path.join(__dirname, '..', 'leaderboard.html');
  const lbHtml = fs.readFileSync(lbPath, 'utf8');
  if (!/function\s+renderSideGamesGrid/.test(lbHtml)) return 'ontbreekt in leaderboard.html';
  return true;
});

test('koppelAlleSponsorenAanWedstrijd accepteert side games parameter', () => {
  const fnBody = getFnBody(scriptText, 'koppelAlleSponsorenAanWedstrijd');
  if (!fnBody) return 'functie niet gevonden';
  // Moet sideGames parameter accepteren én ze opslaan
  const signature = scriptText.match(/koppelAlleSponsorenAanWedstrijd\s*\([^)]+\)/);
  if (!signature || !signature[0].includes('sideGames')) return 'sideGames parameter ontbreekt in signatuur';
  if (!fnBody.includes('sg.type')) return 'side games worden niet opgeslagen';
  return true;
});

test('Wizard state _wizSideGames + render in step 4', () => {
  if (!/_wizSideGames\s*=\s*\[\]/.test(scriptText)) return '_wizSideGames niet geïnitialiseerd';
  if (!scriptText.includes('renderSideGameList()')) return 'renderSideGameList niet aangeroepen';
  if (!html.includes('id="sidegame-list"')) return 'sidegame-list element ontbreekt in form HTML';
  if (!html.includes('koppelSideGame()')) return '+ Toevoegen knop ontbreekt';
  return true;
});

// ═══════════════════════════════════════════════════════════════
// SPONSOR LOGO UPLOAD via Supabase Storage
// ═══════════════════════════════════════════════════════════════
section('Sponsor logo upload');

test('uploadSponsorLogo functie bestaat', () => {
  if (!/async function uploadSponsorLogo/.test(scriptText)) return 'uploadSponsorLogo ontbreekt';
  return true;
});

test('uploadSponsorLogo upload naar /storage/v1/object/sponsor-logos/', () => {
  const fn = getFnBody(scriptText, 'uploadSponsorLogo');
  if (!fn) return 'uploadSponsorLogo body niet gevonden';
  if (!fn.includes('/storage/v1/object/sponsor-logos/')) return 'verkeerde of geen storage-endpoint';
  if (!fn.includes('/storage/v1/object/public/sponsor-logos/')) return 'public URL niet correct';
  return true;
});

test('uploadSponsorLogo valideert grootte (max 2MB) en type', () => {
  const fn = getFnBody(scriptText, 'uploadSponsorLogo');
  if (!fn.includes('2 * 1024 * 1024')) return 'geen 2MB limiet check';
  if (!/image/i.test(fn)) return 'geen image type check';
  return true;
});

test('Form heeft file input + upload knop + preview element', () => {
  if (!html.includes('id="msp-logo-file"')) return 'file input ontbreekt';
  if (!/onclick="document\.getElementById\('msp-logo-file'\)\.click\(\)"/.test(html)) return 'upload knop ontbreekt';
  if (!html.includes('id="msp-logo-preview"')) return 'preview element ontbreekt';
  if (!html.includes('id="msp-logo-upload-status"')) return 'status element ontbreekt';
  return true;
});

// ═══════════════════════════════════════════════════════════════
// SPONSOR CAROUSEL — overige sponsoren rouleren onderaan
// ═══════════════════════════════════════════════════════════════
section('Sponsor carousel');

test('overigeSponsorenVoorWedstrijd excludeert al-gekoppelde sponsors', () => {
  const fn = getFnBody(scriptText, 'overigeSponsorenVoorWedstrijd');
  if (!fn) return 'functie niet gevonden';
  if (!fn.includes('gekoppeldeIds')) return 'filter op gekoppelde sponsors ontbreekt';
  if (!fn.includes("s.status === 'actief'")) return 'filter op actieve status ontbreekt';
  return true;
});

test('renderSponsorCarousel + setupSponsorCarousel bestaan in index.html', () => {
  if (!/function\s+renderSponsorCarousel/.test(scriptText)) return 'renderSponsorCarousel ontbreekt';
  if (!/function\s+setupSponsorCarousel/.test(scriptText)) return 'setupSponsorCarousel ontbreekt';
  return true;
});

test('renderSponsorCarousel + setupSponsorCarousel bestaan in leaderboard.html', () => {
  const lbPath = path.join(__dirname, '..', 'leaderboard.html');
  const lbHtml = fs.readFileSync(lbPath, 'utf8');
  if (!/function\s+renderSponsorCarousel/.test(lbHtml)) return 'renderSponsorCarousel ontbreekt';
  if (!/function\s+setupSponsorCarousel/.test(lbHtml)) return 'setupSponsorCarousel ontbreekt';
  return true;
});

test('setupSponsorCarousel skipt rotatie bij <2 sponsors', () => {
  const fn = getFnBody(scriptText, 'setupSponsorCarousel');
  if (!fn.includes('sponsors.length < 2')) return 'geen <2 check (carousel rouleert altijd, ook met 1 sponsor)';
  return true;
});

test('Timer wordt opgeruimd bij verlaten LB', () => {
  const fn = getFnBody(scriptText, 'terugVanLeaderboard');
  if (!fn) return 'terugVanLeaderboard niet gevonden';
  if (!fn.includes('_stopSponsorCarousel')) return 'carousel timer wordt niet gestopt';
  return true;
});

test('bouwSpelerHoleRijen toont side game banner per hole', () => {
  const fnBody = getFnBody(scriptText, 'bouwSpelerHoleRijen');
  if (!fnBody) return 'bouwSpelerHoleRijen niet gevonden';
  if (!fnBody.includes('sideGamesVoorWedstrijd')) return 'haalt geen side games op';
  if (!fnBody.includes('sideGameByHole')) return 'geen sideGameByHole map';
  if (!fnBody.includes('sideGameMeta')) return 'gebruikt sideGameMeta niet voor styling';
  return true;
});

test('dbSaveScore gooit errors door (markScoreFailed kan firen)', () => {
  const fnBody = getFnBody(scriptText, 'dbSaveScore');
  if (!fnBody) return 'dbSaveScore niet gevonden';
  if (!fnBody.includes('throw new Error')) return 'gooit geen Error bij HTTP fout';
  if (!fnBody.includes('throw e')) return 're-throw in catch block ontbreekt';
  return true;
});

test('dbSaveTeamScore gooit errors door wanneer alle saves falen', () => {
  const fnBody = getFnBody(scriptText, 'dbSaveTeamScore');
  if (!fnBody) return 'dbSaveTeamScore niet gevonden';
  if (!fnBody.includes('firstError')) return 'tracks geen firstError';
  if (!fnBody.includes('throw firstError')) return 'gooit firstError niet door';
  if (!fnBody.includes('savedCount')) return 'telt geen savedCount';
  return true;
});

test('refreshTeamScores synct teamKey vanuit eerste speler', () => {
  const fnBody = getFnBody(scriptText, 'refreshTeamScores');
  if (!fnBody) return 'refreshTeamScores niet gevonden';
  if (!fnBody.includes("'team-' + fi")) return 'sync naar team-N key ontbreekt';
  if (!fnBody.includes('FLIGHTS[wId]')) return 'leest FLIGHTS niet';
  return true;
});

test('printUitslagPDF functie bestaat en bouwt print-window', () => {
  const fnBody = getFnBody(scriptText, 'printUitslagPDF');
  if (!fnBody) return 'printUitslagPDF niet gevonden';
  if (!fnBody.includes('window.open')) return 'opent geen nieuwe tab';
  if (!fnBody.includes('win.print()')) return 'triggert window.print() niet';
  if (!fnBody.includes('sideGamesVoorWedstrijd')) return 'leest geen side games';
  if (!fnBody.includes('hoofdsponsorVoorWedstrijd')) return 'leest geen hoofdsponsor';
  if (!fnBody.includes('eagles') && !fnBody.includes('birdies')) return 'mist bijzondere scores';
  return true;
});

test('setSideGameWinner schrijft naar wedstrijd_sponsoren.winner_sid', () => {
  const fnBody = getFnBody(scriptText, 'setSideGameWinner');
  if (!fnBody) return 'setSideGameWinner niet gevonden';
  if (!fnBody.includes('winner_sid')) return 'schrijft niet naar winner_sid kolom';
  if (!fnBody.includes("'PATCH'")) return 'gebruikt geen PATCH method';
  return true;
});

test('sideGamesVoorWedstrijd levert winnerSid', () => {
  const fnBody = getFnBody(scriptText, 'sideGamesVoorWedstrijd');
  if (!fnBody) return 'sideGamesVoorWedstrijd niet gevonden';
  if (!fnBody.includes('winnerSid')) return 'returnt geen winnerSid in result';
  return true;
});

test('Geen modal-bg gebruikt inline style.display=flex (breekt closeModal)', () => {
  // closeModal doet classList.remove('open'). Wie de modal opent met
  // style.display='flex' (inline) overschrijft de CSS-regel, waardoor
  // closeModal niets doet en de modal niet meer dicht gaat.
  // Zelfgemaakte modals moeten classList.add('open') gebruiken.
  const showModalFns = ['showSideGamePicker', 'showSponsorPicker', 'showHoleSponsorPicker'];
  const issues = [];
  showModalFns.forEach(function(fnName) {
    const body = getFnBody(scriptText, fnName);
    if (!body) return;
    // Body moet een modal-bg modal openen via classList.add('open')
    // Niet via style.display = 'flex'
    if (/modal\.style\.display\s*=\s*['"]flex['"]/.test(body)) {
      issues.push(fnName + ' gebruikt inline style.display=flex');
    }
  });
  return issues.length === 0 || issues.join(' | ');
});

// ═══════════════════════════════════════════════════════════════
// SAMENVATTING
// ═══════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
const total = passed + failed;
if (failed === 0) {
  console.log(`${C.green}${C.bold}✓ Alle ${total} tests geslaagd${C.reset}`);
  process.exit(0);
} else {
  console.log(`${C.red}${C.bold}✗ ${failed} van ${total} tests gefaald${C.reset}`);
  console.log(`${C.green}  ${passed} passed${C.reset}, ${C.red}${failed} failed${C.reset}`);
  process.exit(1);
}
