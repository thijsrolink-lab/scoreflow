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
  const mainScript = scripts[scripts.length - 1].content;
  const pattern = /parseInt\s*\(\s*document\.getElementById\s*\(\s*['"](?:fl-w|sc-w|mi-w|rang-w|sk-w|ing-fw)['"][^)]*\)\.value/;
  const matches = mainScript.match(new RegExp(pattern.source, 'g')) || [];
  return matches.length === 0
    || `parseInt op dropdown gevonden (UUIDs zijn strings!): ${matches.length}x`;
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
  // Patroon: onclick="editW('+w.id+')" → fout (geen quotes rond UUID)
  //          onclick="editW(\''+w.id+'\')" → goed
  const mainScript = scripts[scripts.length - 1].content;
  const badPatterns = [
    /onclick=\\"(\w+)\('\+\w+\.id\+'\)\\"/g,
    /onclick=\\"(\w+)\('\+comp\.id\+'\)\\"/g,
  ];
  const bad = [];
  badPatterns.forEach(p => {
    const m = mainScript.match(p) || [];
    m.forEach(x => bad.push(x.slice(0, 50)));
  });
  return bad.length === 0 || `Onclick zonder quotes: ${bad.slice(0,2).join('; ')}`;
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
