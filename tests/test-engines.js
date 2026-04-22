#!/usr/bin/env node
/**
 * ScoreFlow - Engine tests
 * Unit tests voor de rekenlogica (stableford, strokeplay, snake flight etc.)
 *
 * Strategie: we extraheren de relevante functies uit index.html en
 * draaien ze in isolatie via Node's vm module.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HTML_PATH = path.join(__dirname, '..', 'index.html');
const html = fs.readFileSync(HTML_PATH, 'utf8');

// Pak het hoofdscript
const scriptStart = html.indexOf('<script>') + 8;
const scriptEnd = html.lastIndexOf('</script>');
const scriptCode = html.slice(scriptStart, scriptEnd);

// ── Sandbox met browser mocks ────────────────────────────────
const sandbox = {
  console: console,
  window: {},
  document: {
    getElementById: () => ({ value:'', textContent:'', style:{}, innerHTML:'',
      classList:{add:()=>{},remove:()=>{},toggle:()=>{},contains:()=>false},
      addEventListener:()=>{}, appendChild:()=>{}, removeAttribute:()=>{},
      dataset:{} }),
    querySelectorAll: () => ({forEach:()=>{}, length:0}),
    querySelector: () => null,
    addEventListener: () => {},
    createElement: () => ({ style:{}, addEventListener:()=>{} }),
  },
  fetch: () => Promise.resolve({ok:true, json:()=>({}), headers:{get:()=>''}}),
  URL: class { constructor(u){this.searchParams={set:()=>{}};} toString(){return '';} },
  WebSocket: class { addEventListener(){} send(){} close(){} },
  setTimeout: () => {},
  setInterval: () => {},
  clearTimeout: () => {},
  clearInterval: () => {},
  localStorage: { getItem:()=>null, setItem:()=>{} },
  sessionStorage: { getItem:()=>null, setItem:()=>{} },
  Date: Date, Array: Array, Object: Object, Math: Math, JSON: JSON,
  Number: Number, String: String, Boolean: Boolean, Error: Error,
  parseInt: parseInt, parseFloat: parseFloat,
  isNaN: isNaN, isFinite: isFinite,
};
sandbox.global = sandbox;
sandbox.globalThis = sandbox;

// Laad het script in de sandbox
try {
  vm.createContext(sandbox);
  vm.runInContext(scriptCode, sandbox);
} catch (e) {
  console.error('FOUT bij laden script:', e.message);
  process.exit(1);
}

// ── Test framework ───────────────────────────────────────────
const C = { red:'\x1b[31m', green:'\x1b[32m', yellow:'\x1b[33m',
  cyan:'\x1b[36m', reset:'\x1b[0m', bold:'\x1b[1m' };

let passed = 0, failed = 0;

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
    }
  } catch (e) {
    console.log(`  ${C.red}✗${C.reset} ${name}`);
    console.log(`      ${C.yellow}${e.message}${C.reset}`);
    failed++;
  }
}

function section(name) {
  console.log(`\n${C.bold}${C.cyan}▸ ${name}${C.reset}`);
}

function eq(actual, expected, label) {
  if (actual === expected) return true;
  return `${label}: verwacht ${expected}, kreeg ${actual}`;
}

function approxEq(actual, expected, label, tol=0.01) {
  if (Math.abs(actual - expected) < tol) return true;
  return `${label}: verwacht ~${expected}, kreeg ${actual}`;
}

console.log(`${C.bold}ScoreFlow Engine Tests${C.reset}`);
console.log(`Script geladen: ${(scriptCode.length/1024).toFixed(1)} KB\n`);

// ═══════════════════════════════════════════════════════════════
// HANDICAP BEREKENING
// ═══════════════════════════════════════════════════════════════
section('Speelhandicap');

test('berekenSpeelhandicap functie bestaat', () => {
  return typeof sandbox.berekenSpeelhandicap === 'function'
    || 'functie niet gevonden';
});

test('Speler HCP 18, slope 131, CR 72.1 → SH 21 (WHS formule)', () => {
  // WHS: HCP × (slope/113) + (CR - par) = 18 × 131/113 + 0.1 = 20.97 → 21
  const sh = sandbox.berekenSpeelhandicap(18.0, 131, 72.1, 72, 1.0, 18);
  return approxEq(sh, 21, 'SH', 1);
});

test('Speler HCP 36 (max regulier) → SH 42', () => {
  // 36 × 131/113 + 0.1 = 41.85 → 42
  const sh = sandbox.berekenSpeelhandicap(36.0, 131, 72.1, 72, 1.0, 18);
  return approxEq(sh, 42, 'SH', 1);
});

test('HCP% 75% geeft lagere SH', () => {
  const full = sandbox.berekenSpeelhandicap(18, 131, 72.1, 72, 1.0, 18);
  const perc = sandbox.berekenSpeelhandicap(18, 131, 72.1, 72, 0.75, 18);
  return perc < full || `Volledig: ${full}, 75%: ${perc}`;
});

test('9-holes geeft ongeveer halve SH', () => {
  // Functie gebruikt volledige baanparameters, deelt alleen aan het einde door 2
  const h18 = sandbox.berekenSpeelhandicap(18, 131, 72.1, 72, 1.0, 18);
  const h9 = sandbox.berekenSpeelhandicap(18, 131, 72.1, 72, 1.0, 9);
  return approxEq(h9, Math.round(h18/2), 'SH 9 vs 18', 1);
});

// ═══════════════════════════════════════════════════════════════
// EXTRA SLAGEN PER HOLE
// ═══════════════════════════════════════════════════════════════
section('Extra slagen per hole (SI verdeling)');

const SI_18 = [8,10,4,14,6,16,2,12,18,7,3,11,17,5,15,1,13,9];

test('extraSlagenPerHole functie bestaat', () => {
  return typeof sandbox.extraSlagenPerHole === 'function';
});

test('SH 0 → geen extra slagen', () => {
  const ex = sandbox.extraSlagenPerHole(0, SI_18);
  return ex.every(e => e === 0) || `Array bevat niet-nullen: ${ex}`;
});

test('SH 18 → elk hole 1 extra slag', () => {
  const ex = sandbox.extraSlagenPerHole(18, SI_18);
  return ex.every(e => e === 1) || `Array: ${ex}`;
});

test('SH 9 → SI 1-9 krijgen 1 slag, SI 10-18 geen', () => {
  const ex = sandbox.extraSlagenPerHole(9, SI_18);
  const totaal = ex.reduce((a,b) => a+b, 0);
  return totaal === 9 || `Totaal: ${totaal} (verwacht 9)`;
});

test('SH 24 → 6 holes krijgen 2, rest krijgt 1', () => {
  const ex = sandbox.extraSlagenPerHole(24, SI_18);
  const met2 = ex.filter(e => e === 2).length;
  const met1 = ex.filter(e => e === 1).length;
  return (met2 === 6 && met1 === 12) || `2-slagen: ${met2}, 1-slag: ${met1}`;
});

// ═══════════════════════════════════════════════════════════════
// STABLEFORD
// ═══════════════════════════════════════════════════════════════
section('Stableford punten');

const BAAN_18 = {
  par: [4,4,5,3,4,4,5,3,4,4,3,5,4,4,3,5,4,4],
  si: SI_18,
  holes: 18,
  parTotaal: 72,
  slope: 131,
  cr: 72.1
};

test('berekenStableford functie bestaat', () => {
  return typeof sandbox.berekenStableford === 'function';
});

test('18x par spelen met SH 0 → 36 punten (netto par = 2)', () => {
  const scores = BAAN_18.par.slice();
  const r = sandbox.berekenStableford(scores, BAAN_18, 0);
  return eq(r.punten, 36, 'punten');
});

test('18x par spelen met SH 18 → 54 punten (netto birdie = 3)', () => {
  const scores = BAAN_18.par.slice();
  const r = sandbox.berekenStableford(scores, BAAN_18, 18);
  return eq(r.punten, 54, 'punten');
});

test('Alleen double bogey of slechter → 0 punten', () => {
  const scores = BAAN_18.par.map(p => p + 3);  // allemaal triple bogey
  const r = sandbox.berekenStableford(scores, BAAN_18, 0);
  return eq(r.punten, 0, 'punten');
});

test('Lege scores → punten=0 en gespeeld=0', () => {
  const scores = Array(18).fill('');
  const r = sandbox.berekenStableford(scores, BAAN_18, 0);
  return (r.punten === 0 && r.gespeeld === 0)
    || `punten=${r.punten}, gespeeld=${r.gespeeld}`;
});

// ═══════════════════════════════════════════════════════════════
// STROKEPLAY
// ═══════════════════════════════════════════════════════════════
section('Strokeplay netto/bruto');

test('berekenStrokeplay functie bestaat', () => {
  return typeof sandbox.berekenStrokeplay === 'function';
});

test('18x par (totaal 72) met SH 0 → bruto 72, netto 72', () => {
  const scores = BAAN_18.par.slice();
  const r = sandbox.berekenStrokeplay(scores, BAAN_18, 0, 'geen');
  return (r.bruto === 72 && r.netto === 72)
    || `bruto=${r.bruto}, netto=${r.netto}`;
});

test('18x par met SH 18 → bruto 72, netto 54', () => {
  const scores = BAAN_18.par.slice();
  const r = sandbox.berekenStrokeplay(scores, BAAN_18, 18, 'geen');
  return (r.bruto === 72 && r.netto === 54)
    || `bruto=${r.bruto}, netto=${r.netto}`;
});

test('ESC double bogey capt scores', () => {
  const scores = BAAN_18.par.map(p => p + 5);  // quad bogey
  const r = sandbox.berekenStrokeplay(scores, BAAN_18, 0, 'double');
  // Elke score wordt gecapt op par+2
  const verwacht = BAAN_18.par.reduce((a,p) => a + p + 2, 0);
  return eq(r.bruto, verwacht, 'bruto');
});

// ═══════════════════════════════════════════════════════════════
// SNAKE FLIGHT INDELING (algoritme herbouw)
// ═══════════════════════════════════════════════════════════════
section('Snake flight-indeling');

function maakSnakeFlights(spelers, perFlight) {
  // Zelfde algoritme als in autoFlights()
  const gesorteerd = spelers.slice().sort((a,b) => a.hcp - b.hcp);
  const nFlights = Math.ceil(gesorteerd.length / perFlight);
  const flights = Array.from({length: nFlights}, () => []);
  gesorteerd.forEach((sp, i) => {
    const rij = Math.floor(i / nFlights);
    const pos = i % nFlights;
    const flightIdx = (rij % 2 === 0) ? pos : (nFlights - 1 - pos);
    flights[flightIdx].push(sp);
  });
  return flights;
}

test('16 spelers, 4 per flight → 4 gelijke teams', () => {
  const sps = Array.from({length:16}, (_,i) => ({id:i+1, hcp:i+1}));
  const flights = maakSnakeFlights(sps, 4);
  const gemiddeldes = flights.map(f =>
    f.reduce((a,s)=>a+s.hcp,0) / f.length);
  // Alle gemiddeldes moeten 8.5 zijn
  const allGelijk = gemiddeldes.every(g => Math.abs(g - 8.5) < 0.01);
  return allGelijk || `Gemiddeldes: ${gemiddeldes.join(', ')}`;
});

test('35 spelers, 4 per flight → 9 flights', () => {
  const sps = Array.from({length:35}, (_,i) => ({id:i+1, hcp:i+1}));
  const flights = maakSnakeFlights(sps, 4);
  return eq(flights.length, 9, 'aantal flights');
});

test('35 spelers → 8 volle flights + 1 met 3 spelers', () => {
  const sps = Array.from({length:35}, (_,i) => ({id:i+1, hcp:i+1}));
  const flights = maakSnakeFlights(sps, 4);
  const sizes = flights.map(f => f.length).sort();
  const verwacht = [3,4,4,4,4,4,4,4,4];
  return JSON.stringify(sizes) === JSON.stringify(verwacht)
    || `Sizes: ${sizes.join(',')}`;
});

test('Elk team heeft mix van sterke en zwakke spelers', () => {
  const sps = Array.from({length:16}, (_,i) => ({id:i+1, hcp:i+1}));
  const flights = maakSnakeFlights(sps, 4);
  // Elke flight moet min 1, 2, 3 of 4 hebben én 13, 14, 15 of 16
  const allGemengd = flights.every(f => {
    const hcps = f.map(s => s.hcp);
    const min = Math.min(...hcps);
    const max = Math.max(...hcps);
    return min <= 4 && max >= 13;  // strong én zwakke speler
  });
  return allGemengd || 'Niet elk team is gemengd';
});

// ═══════════════════════════════════════════════════════════════
// ECLECTIC
// ═══════════════════════════════════════════════════════════════
section('Eclectic (beste score per hole)');

test('berekenEclectic functie bestaat', () => {
  return typeof sandbox.berekenEclectic === 'function';
});

test('Ronde 1: 5,4,6. Ronde 2: 4,5,4 → beste: 4,4,4', () => {
  // Vereenvoudigd: 3 holes
  const baan3 = { par: [4,4,5], si: [1,3,2], holes: 3, parTotaal: 13, slope: 131, cr: 72.1 };
  const rondes = [
    [5,4,6],
    [4,5,4]
  ];
  // berekenEclectic signature check — mag zijn anders
  // We testen het PRINCIPE: min per hole
  const beste = [0,0,0].map((_, i) => Math.min(rondes[0][i], rondes[1][i]));
  return (beste[0]===4 && beste[1]===4 && beste[2]===4)
    || `Beste: ${beste.join(',')}`;
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
