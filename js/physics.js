'use strict';
/* ---------- particle identification & stability engine ---------- */
const FM = { // [mass GeV, colors, type: 0 lepton / 1 up-type / 2 down-type]
  e: [0.000511, 1, 0], mu: [0.105658, 1, 0], tau: [1.77686, 1, 0],
  u: [0.00216, 3, 1], d: [0.00467, 3, 2], s: [0.0934, 3, 2], c: [1.27, 3, 1], b: [4.18, 3, 2], t: [172.76, 3, 1]
};

function massOk(pm, m) {
  if (pm === 0) return m === 0;
  return m > 0 && Math.abs(Math.log10(m / pm)) < 0.0177; // within ~4%
}
function matchP(p, s) {
  if (!massOk(p.m, s.m)) return false;
  if (p.qt !== s.qt || p.spin !== s.spin) return false;
  if (p.colored !== !!s.colorCharged) return false;
  if (p.useAnti && p.anti !== s.anti) return false;
  return true;
}

function logDist(a, b) {
  if (a === 0 && b === 0) return 0;
  if (a === 0 || b === 0) return 5;
  return Math.abs(Math.log10(a / b));
}

function nearestKnown(s) {
  let best = null;
  for (const p of PARTICLES) {
    const d = logDist(p.m, s.m);
    const score = (d < 0.15 ? 1 : 0) + (p.qt === s.qt ? 1 : 0) + (p.spin === s.spin ? 1 : 0) + (p.colored === !!s.colorCharged ? 1 : 0);
    if (!best || score > best.score || (score === best.score && d < best.d)) best = { p, score, d };
  }
  const p = best.p, diffs = [];
  if (!massOk(p.m, s.m)) diffs.push('mass');
  if (p.qt !== s.qt) diffs.push('charge');
  if (p.spin !== s.spin) diffs.push('spin');
  if (p.colored !== !!s.colorCharged) diffs.push('color');
  if (p.useAnti && p.colored === !!s.colorCharged && p.anti !== s.anti) diffs.push('matter/antimatter flag (antiquarks carry anti-color)');
  return { p, diffs };
}

/* Rough decay estimate for a hypothetical state. Returns {tau (s) | Infinity | null, ch} */
function estimateDecay(s) {
  const mG = s.m / 1000, colored = !!s.colorCharged, qt = s.qt, sp = s.spin, frac = qt % 3 !== 0;
  const T = gGeV => HBAR / (gGeV * 1000);
  if (s.m === 0) return { tau: Infinity, ch: 'Massless: nothing lighter to decay into.' };
  if (colored) {
    const gf = GF * mG ** 3 / (8 * Math.PI * Math.SQRT2);
    if (gf > 0.2) return { tau: T(gf), ch: 'Decays weakly faster than it can hadronize (top-like, Γ ≈ G_F m³ / 8π√2).' };
    return { tau: 3.3e-24, ch: 'Hadronizes into color-neutral bound states within ~3×10⁻²⁴ s (ħ/Λ_QCD); the resulting hadron decays later.' };
  }
  if (frac) return { tau: Infinity, ch: 'Charge conservation forbids decay into integer-charge SM particles, so it would be absolutely stable.' };
  if (sp === 0.5) {
    if (qt === 0) return { tau: Infinity, ch: 'Neutral, colorless: stable, or decays only through tiny mixing with neutrinos (sterile-neutrino / dark-matter-like).' };
    if (s.m < 0.5109) return { tau: Infinity, ch: 'Lighter than the electron: lightest charged fermion, nothing to decay into.' };
    const off = 2.285e-14 * mG ** 5;
    let on = 0;
    if (mG > MW) { const r = (MW / mG) ** 2; on = GF * mG ** 3 / (8 * Math.PI * Math.SQRT2) * (1 - r) ** 2 * (1 + 2 * r); }
    return { tau: T(Math.max(off, on)), ch: on > off ? 'ℓ′ → W + ν with an on-shell W.' : 'ℓ′ → ℓ + ν ν̅ via virtual W (Γ ∝ G_F² m⁵, Sargent rule).' };
  }
  if (sp === 0) {
    if (qt === 0) {
      let g = 0, any = false;
      for (const k in FM) { const [mf, nc] = FM[k]; if (2 * mf < mG) { any = true; const b = Math.sqrt(1 - 4 * mf * mf / (mG * mG)); g += nc * GF * mf * mf * mG * b ** 3 / (4 * Math.PI * Math.SQRT2); } }
      if (!any) return { tau: null, ch: 'Below 2mₑ: only γγ (loop-induced); extremely long-lived.' };
      return { tau: T(g), ch: 'φ → f f̅ with Higgs-like couplings ∝ m_f (heaviest open fermion pair dominates).' };
    }
    let g = 0;
    for (const k of ['e', 'mu', 'tau']) { const mf = FM[k][0]; if (mG > mf) g += GF * mf * mf * mG * (1 - mf * mf / (mG * mG)) ** 2 / (4 * Math.PI * Math.SQRT2); }
    if (mG > 1.27) g += 3 * GF * 1.27 ** 2 * mG / (4 * Math.PI * Math.SQRT2);
    if (mG > 177) g += 3 * GF * 172.76 ** 2 * mG * (1 - (172.76 / mG) ** 2) ** 2 / (4 * Math.PI * Math.SQRT2);
    if (g === 0) return { tau: Infinity, ch: 'Lighter than the electron: lightest charged state, stable.' };
    return { tau: T(g), ch: 'H⁺-like: decays to the heaviest open fermion pair (τν, c s̅, t b̅), couplings ∝ m_f.' };
  }
  // spin 1
  if (qt === 0) {
    let ne = 3;
    for (const k in FM) { const [mf, , ty] = FM[k]; if (2 * mf < mG) ne += ty === 0 ? 0.5 : (ty === 1 ? 1.75 : 2.3); }
    return { tau: T(GF * mG ** 3 / (12 * Math.PI * Math.SQRT2) * ne), ch: 'Z′-like with SM-strength couplings: νν̅, ℓ⁺ℓ⁻ and q q̅.' };
  }
  let nd = 0;
  for (const k of ['e', 'mu', 'tau']) if (mG > FM[k][0]) nd += 1;
  if (mG > 0.0069) nd += 3;
  if (mG > 1.36) nd += 3;
  if (mG > 176.9) nd += 3;
  if (nd === 0) return { tau: Infinity, ch: 'Lighter than the electron: no open channel.' };
  return { tau: HBAR / (GF * mG ** 3 / (6 * Math.PI * Math.SQRT2) * nd * 1000), ch: 'W′-like with SM-strength couplings: ℓν and q q′̅.' };
}

function analyze(s) {
  const colored = !!s.colorCharged, fermion = s.spin === 0.5, frac = s.qt % 3 !== 0;
  const out = { colored, fermion, warns: [] };
  const w = out.warns;
  const matches = PARTICLES.filter(p => matchP(p, s));

  w.push(['info', fermion
    ? 'Spin ½ ⇒ fermion: Fermi–Dirac statistics, Pauli exclusion applies. Spin-statistics theorem satisfied.'
    : `Spin ${s.spin === 0 ? '0' : '1'} ⇒ boson: Bose–Einstein statistics, no exclusion. Spin-statistics theorem satisfied.`]);

  if (matches.length) {
    const p = matches[0];
    out.status = 'known';
    out.name = matches.length > 1 ? (p.family || matches.map(x => x.name).join(' / ')) : p.name;
    out.sym = matches.length > 1 && p.family ? 'ν' : matches.map(x => x.sym).join(' / ');
    out.cls = p.cls; out.forces = p.forces; out.mediates = p.mediates;
    out.lifeText = p.life; out.tau = p.tau; out.chText = null;
    if (p.note) w.push(['info', p.note]);
    return out;
  }

  out.status = 'hyp';
  out.name = 'Unnamed state';
  out.sym = 'X';
  out.cls = fermion
    ? (colored ? (frac ? 'Fermion · Quark-like' : 'Fermion · Leptoquark-like') : (s.qt === 0 ? 'Fermion · Neutral lepton-like' : 'Fermion · Lepton-like'))
    : (s.spin === 1 ? 'Boson · Vector (gauge-like)' : 'Boson · Scalar');
  const f = [];
  if (colored) f.push('Strong');
  if (s.qt !== 0) f.push('Electromagnetic');
  f.push('Gravity');
  if (s.m > 0) f.push('Weak (unknown, not set by these sliders)');
  out.forces = f; out.mediates = null;

  const near = nearestKnown(s);
  out.nearest = near;
  const mG = s.m / 1000;

  if (s.m === 0 && s.qt !== 0) w.push(['bad', 'Massless charged particle: excluded. An unscreened photon coupling with no mass gap contradicts observation.']);
  if (frac && !colored) w.push(['bad', 'Fractional charge without color: free fractional charges have never been seen. In the SM only confined quarks carry them.']);

  if (colored) {
    w.push(['warn', fermion && frac
      ? 'Color confinement: a single isolated quark cannot exist. It hadronizes into a meson/baryon (a jet), never a free track.'
      : 'Color confinement: any isolated colored state is forbidden; it must bind into a color-neutral hadron.']);
    if (fermion && !frac) w.push(['warn', 'Integer-charge colored fermion: leptoquark-like exotic with no SM analogue.']);
    if (fermion && frac) w.push(['info', 'Quark quantum numbers but the mass matches none of the six flavors. A fourth chiral generation is strongly disfavored by Higgs production rates and electroweak fits.']);
    if (s.spin === 0) w.push(['info', 'Colored scalar: squark / leptoquark-like.']);
    if (s.spin === 1) w.push(['info', s.m > 0 ? 'Massive colored vector: coloron-like, needs an extra gauge group.' : 'Massless colored vector that is not the gluon: inconsistent with unbroken SU(3) color.']);
  } else if (!frac) {
    if (s.m === 0 && s.qt === 0 && s.spin === 0) w.push(['info', 'Massless neutral scalar: Goldstone-like. Long-range scalar forces are tightly constrained. (This is the blank starting state.)']);
    if (fermion && s.qt === 0 && s.m > 0) {
      w.push(['info', 'Massive neutral colorless fermion: sterile / Majorana neutrino or dark-matter-like.']);
      if (mG < 45.59) w.push(['warn', 'With full weak coupling it would add to the Z invisible width (only 3 light active neutrinos allowed). Only a sterile version survives.']);
    }
    if (fermion && s.qt !== 0 && s.m > 0) {
      if (s.m < 0.5109) w.push(['bad', 'Lighter than the electron: a stable charged particle below mₑ is excluded by millicharge/universality bounds.']);
      else if (mG < 100) w.push(['warn', 'A fourth charged lepton below ~100 GeV is excluded by LEP searches.']);
      else w.push(['info', 'Lepton-like. Only three charged-lepton generations are known.']);
    }
    if (s.spin === 0 && s.qt === 0 && s.m > 0) w.push(['info', 'Neutral scalar: Higgs-like or dark-matter-like. Mixing with the 125 GeV Higgs is tightly constrained.']);
    if (s.spin === 0 && s.qt !== 0 && s.m > 0) {
      w.push(['info', 'Charged scalar (H⁺-like, as in two-Higgs-doublet models).']);
      if (mG < 80) w.push(['bad', 'Charged scalars below ~80 GeV are excluded by LEP pair-production searches.']);
    }
    if (s.spin === 1 && s.m > 0) {
      w.push(['info', 'Massive vector boson: needs the Higgs mechanism (or a Stueckelberg mass) to keep the gauge theory consistent.']);
      if (s.qt === 0) w.push(['warn', 'A Z′ with SM-strength couplings is excluded below several TeV; weaker couplings (dark-photon-like) can survive.']);
      else if (mG < 80) w.push(['bad', 'A charged vector below ~80 GeV is excluded by LEP and Tevatron data.']);
      else w.push(['info', 'W′-like: LHC excludes SM-strength W′ below several TeV.']);
    }
  }
  if (near.diffs.length && near.diffs.length <= 2) w.push(['info', `Closest known state: ${near.p.name} (${near.p.sym}). Differs in: ${near.diffs.join(', ')}.`]);

  const est = estimateDecay(s);
  out.tau = est.tau; out.chText = est.ch; out.lifeText = null;
  return out;
}
