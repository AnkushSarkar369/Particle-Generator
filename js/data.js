'use strict';
/* ---------- constants & slider mappings ---------- */
const LOG_MIN = -1;                       // 0.1 MeV at slider v=1
const LOG_MAX = Math.log10(173000);       // 173 GeV at slider v=1000
const V_MAX = 1000;
const massFromV = v => v <= 0 ? 0 : Math.pow(10, LOG_MIN + (v / V_MAX) * (LOG_MAX - LOG_MIN));
const vFromMass = m => m <= 0 ? 0 : Math.round((Math.log10(m) - LOG_MIN) / (LOG_MAX - LOG_MIN) * V_MAX);

const HBARC = 197.3269804;       // MeV fm
const HBAR  = 6.582119569e-22;   // MeV s
const GF    = 1.1663788e-5;      // GeV^-2
const MW    = 80.379;            // GeV

const COLOR_NAMES = ['None', 'Red', 'Green', 'Blue'];
const ANTI_COLOR_NAMES = ['None', 'Anti-red', 'Anti-green', 'Anti-blue'];
const SPIN_VALUES = [0, 0.5, 1];
const CHARGE_THIRDS = [-3, -2, -1, 0, 1, 2, 3];

/* ---------- Standard Model catalogue (PDG-style central values, MeV/c^2) ---------- */
const PARTICLES = [];
(function () {
  const bar = s => s + '\u0304';
  const QF = ['Strong', 'Electromagnetic', 'Weak', 'Gravity'];

  // [id, name, symbol, mass, charge(thirds), generation, lifetime text, tau(s)|null]
  const quarks = [
    ['u', 'Up quark', 'u', 2.16, 2, 1, 'Never free. Stable inside protons and neutrons.', Infinity],
    ['d', 'Down quark', 'd', 4.67, -1, 1, 'Never free. Stable inside protons; neutrons decay via d\u2192u (\u224815 min free).', Infinity],
    ['c', 'Charm quark', 'c', 1270, 2, 2, 'Never free. Charm hadrons live ~10\u207B\u00B9\u00B2 s (weak decay).', null],
    ['s', 'Strange quark', 's', 93.4, -1, 2, 'Never free. Strange hadrons live ~10\u207B\u00B9\u2070 s (weak decay).', null],
    ['t', 'Top quark', 't', 172760, 2, 3, 'Lifetime \u22485\u00D710\u207B\u00B2\u2075 s. Decays (t\u2192Wb) before it can hadronize.', 5.0e-25],
    ['b', 'Bottom quark', 'b', 4180, -1, 3, 'Never free. B hadrons live ~1.6\u00D710\u207B\u00B9\u00B2 s (weak decay).', null]
  ];
  for (const [id, name, sym, m, qt, gen, life, tau] of quarks) {
    const base = { gen, m, spin: 0.5, colored: true, useAnti: true, cls: 'Fermion \u00B7 Quark', forces: QF, mediates: null,
      life, tau, note: 'Color confinement: quarks are only ever observed inside color-neutral hadrons.' };
    PARTICLES.push({ ...base, id, name, sym, qt, anti: false, group: 'Quarks' });
    PARTICLES.push({ ...base, id: 'anti-' + id, name: 'Anti-' + name.toLowerCase(), sym: bar(sym), qt: -qt, anti: true, group: 'Antiparticles' });
  }

  const LF = ['Electromagnetic', 'Weak', 'Gravity'];
  const leptons = [
    ['e', 'Electron', 'Positron', 'e\u207B', 'e\u207A', 0.511, 1, 'Stable.', Infinity],
    ['mu', 'Muon', 'Antimuon', '\u03BC\u207B', '\u03BC\u207A', 105.658, 2, 'Lifetime 2.197\u00D710\u207B\u2076 s (\u03BC\u2192e \u03BD\u0305 \u03BD).', 2.197e-6],
    ['tau', 'Tau', 'Antitau', '\u03C4\u207B', '\u03C4\u207A', 1776.86, 3, 'Lifetime 2.903\u00D710\u207B\u00B9\u00B3 s (many channels).', 2.903e-13]
  ];
  for (const [id, name, aname, sym, asym, m, gen, life, tau] of leptons) {
    const base = { gen, m, spin: 0.5, colored: false, useAnti: false, cls: 'Fermion \u00B7 Lepton', forces: LF, mediates: null, life, tau, note: null };
    PARTICLES.push({ ...base, id, name, sym, qt: -3, anti: false, group: 'Leptons' });
    PARTICLES.push({ ...base, id: 'anti-' + id, name: aname, sym: asym, qt: 3, anti: true, group: 'Antiparticles' });
  }

  const nus = [['nu_e', 'Electron neutrino', '\u03BD\u2091', 1], ['nu_mu', 'Muon neutrino', '\u03BD\u03BC', 2], ['nu_tau', 'Tau neutrino', '\u03BD\u03C4', 3]];
  for (const [id, name, sym, gen] of nus) {
    const base = { gen, m: 0, spin: 0.5, colored: false, useAnti: true, cls: 'Fermion \u00B7 Lepton (neutrino)', forces: ['Weak', 'Gravity'], mediates: null,
      life: 'Stable. (Oscillations show tiny real masses, below ~0.1 eV; the SM treats them as 0.)', tau: Infinity,
      family: 'Neutrino (flavor not set by these sliders: \u03BD\u2091 / \u03BD\u03BC / \u03BD\u03C4)', note: null };
    PARTICLES.push({ ...base, id, name, sym, qt: 0, anti: false, group: 'Leptons' });
    PARTICLES.push({ ...base, id: 'anti-' + id, name: 'Anti-' + name.toLowerCase(), sym: bar(sym), qt: 0, anti: true, group: 'Antiparticles' });
  }

  const G = 'Gauge bosons';
  PARTICLES.push({ id: 'photon', name: 'Photon', sym: '\u03B3', m: 0, qt: 0, spin: 1, colored: false, useAnti: false, anti: false, group: G,
    cls: 'Boson \u00B7 Gauge (vector)', forces: ['Gravity'], mediates: 'Electromagnetism', life: 'Stable.', tau: Infinity, note: 'Massless and neutral: it is its own antiparticle.' });
  PARTICLES.push({ id: 'gluon', name: 'Gluon', sym: 'g', m: 0, qt: 0, spin: 1, colored: true, useAnti: false, anti: false, group: G,
    cls: 'Boson \u00B7 Gauge (vector)', forces: ['Strong', 'Gravity'], mediates: 'Strong force', life: 'Confined: never free; 8 color-anticolor states.', tau: null,
    note: 'Gluons carry color themselves, so they are confined like quarks.' });
  PARTICLES.push({ id: 'W+', name: 'W\u207A boson', sym: 'W\u207A', m: 80379, qt: 3, spin: 1, colored: false, useAnti: false, anti: false, group: G,
    cls: 'Boson \u00B7 Gauge (vector)', forces: ['Electromagnetic', 'Weak', 'Gravity'], mediates: 'Weak force (charged current)', life: 'Lifetime \u22483\u00D710\u207B\u00B2\u2075 s (\u0393 \u2248 2.09 GeV).', tau: 3.16e-25, note: null });
  PARTICLES.push({ id: 'W-', name: 'W\u207B boson', sym: 'W\u207B', m: 80379, qt: -3, spin: 1, colored: false, useAnti: false, anti: true, group: 'Antiparticles',
    cls: 'Boson \u00B7 Gauge (vector)', forces: ['Electromagnetic', 'Weak', 'Gravity'], mediates: 'Weak force (charged current)', life: 'Lifetime \u22483\u00D710\u207B\u00B2\u2075 s (\u0393 \u2248 2.09 GeV).', tau: 3.16e-25, note: 'Antiparticle of W\u207A.' });
  PARTICLES.push({ id: 'Z', name: 'Z boson', sym: 'Z\u2070', m: 91188, qt: 0, spin: 1, colored: false, useAnti: false, anti: false, group: G,
    cls: 'Boson \u00B7 Gauge (vector)', forces: ['Weak', 'Gravity'], mediates: 'Weak force (neutral current)', life: 'Lifetime \u22482.6\u00D710\u207B\u00B2\u2075 s (\u0393 \u2248 2.50 GeV).', tau: 2.64e-25, note: 'Its own antiparticle.' });
  PARTICLES.push({ id: 'higgs', name: 'Higgs boson', sym: 'H', m: 125250, qt: 0, spin: 0, colored: false, useAnti: false, anti: false, group: 'Higgs boson',
    cls: 'Boson \u00B7 Scalar', forces: ['Weak', 'Higgs (mass-giving) coupling', 'Gravity'], mediates: null, life: 'Lifetime \u22481.6\u00D710\u207B\u00B2\u00B2 s (\u0393 \u2248 4.1 MeV), mostly H\u2192b b\u0305.', tau: 1.56e-22,
    note: 'The only fundamental scalar; its field gives mass to W, Z and the fermions.' });
})();
