'use strict';
(function () {
  const $ = id => document.getElementById(id);
  const el = { preset: $('preset'), anti: $('anti'), reset: $('reset'), mass: $('mass'), charge: $('charge'), spin: $('spin'), energy: $('energy'), card: $('card') };

  /* ---------- formatting ---------- */
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  const sci = x => { const e = Math.floor(Math.log10(x)); return (x / Math.pow(10, e)).toFixed(2) + '×10' + String(e).split('').map(c => SUP[c]).join(''); };
  const fmtMass = m => m === 0 ? '0 (massless)' : m < 1 ? (m * 1000).toPrecision(3) + ' keV/c²' : m < 1000 ? m.toPrecision(4) + ' MeV/c²' : (m / 1000).toPrecision(4) + ' GeV/c²';
  const fmtE = e => e < 1 ? (e * 1000).toPrecision(3) + ' keV' : e < 1e3 ? e.toPrecision(4) + ' MeV' : e < 1e6 ? (e / 1e3).toPrecision(4) + ' GeV' : (e / 1e6).toPrecision(4) + ' TeV';
  const fmtCharge = qt => qt === 0 ? '0' : (qt % 3 === 0 ? (qt < 0 ? '−' : '+') + Math.abs(qt / 3) : (qt < 0 ? '−' : '+') + Math.abs(qt) + '/3') ;
  const fmtSpin = s => s === 0 ? '0' : s === 0.5 ? '½' : '1';
  const fmtLen = fm => fm >= 1e6 ? sci(fm / 1e6) + ' nm' : fm >= 1 ? fm.toPrecision(3) + ' fm' : sci(fm) + ' fm';
  const fmtTau = t => t === Infinity ? 'stable' : t === null ? 'n/a' : sci(t) + ' s';
  const colorName = s => s.colorCharged ? 'Present (non-singlet)' : 'None (singlet)';

  /* ---------- colors ---------- */
  const COLOR_HEX = 0xb9a8ff;
  const CHROMATIC_HEX = 0x7ddbc1;
  const chargeHex = qt => qt > 0 ? 0xff7a45 : qt < 0 ? 0x45b8ff : 0xbfc8ff;

  /* ---------- landmarks & ticks ---------- */
  const LANDMARKS = [['e⁻', 'Electron', 0.511], ['u', 'Up quark', 2.16], ['d', 'Down quark', 4.67], ['s', 'Strange quark', 93.4],
    ['μ⁻', 'Muon', 105.658], ['c', 'Charm quark', 1270], ['τ⁻', 'Tau', 1776.86], ['b', 'Bottom quark', 4180],
    ['W', 'W boson', 80379], ['Z', 'Z boson', 91188], ['H', 'Higgs boson', 125250], ['t', 'Top quark', 172760]]
    .map(([sym, name, m]) => ({ sym, name, m, v: vFromMass(m) })).sort((a, b) => a.v - b.v);

  function buildTicks(id, items, onPick) {
    const c = $(id); c.innerHTML = '';
    items.forEach(it => {
      const d = document.createElement('div');
      d.className = 'tick';
      d.style.left = `calc(7px + (100% - 14px) * ${it.f})`;
      d.title = it.title || '';
      d.innerHTML = `<i style="height:${3 + (it.lvl || 0) * 9}px"></i><span>${it.label}</span>`;
      d.onclick = () => onPick(it.val);
      c.appendChild(d);
    });
  }
  const pick = (input, v) => { input.value = v; sync(true); };

  buildTicks('t-mass', [{ f: 0, label: 'ν γ g', title: 'Massless: neutrinos (SM), photon, gluon', lvl: 0, val: 0 }]
    .concat(LANDMARKS.map((l, i) => ({ f: l.v / 1000, label: l.sym, title: `${l.name}: ${fmtMass(l.m)}`, lvl: (i % 3), val: l.v }))), v => pick(el.mass, v));
  buildTicks('t-charge', CHARGE_THIRDS.map((q, i) => ({ f: i / 6, label: fmtCharge(q).replace('+', ''), val: i })), v => pick(el.charge, v));
  buildTicks('t-spin', [['0', 'scalar (Higgs)'], ['½', 'fermions'], ['1', 'gauge bosons']].map(([label, title], i) => ({ f: i / 2, label, title, val: i })), v => pick(el.spin, v));
  buildTicks('t-energy', [1, 2, 10, 100].map(g => ({ f: Math.log10(g) / 2, label: 'γ=' + g, val: Math.round(Math.log10(g) * 50) })), v => pick(el.energy, v));

  /* ---------- presets ---------- */
  (function () {
    const groups = ['Quarks', 'Leptons', 'Gauge bosons', 'Higgs boson', 'Antiparticles'];
    let html = '<option value="">— custom / hypothetical —</option>';
    for (const g of groups) {
      html += `<optgroup label="${g}">` + PARTICLES.filter(p => p.group === g).map(p => `<option value="${p.id}">${p.name} (${p.sym})</option>`).join('') + '</optgroup>';
    }
    el.preset.innerHTML = html;
  })();

  let applying = false;
  function applyPreset(id) {
    const p = PARTICLES.find(x => x.id === id);
    if (!p) return;
    applying = true;
    el.mass.value = vFromMass(p.m);
    el.charge.value = p.qt + 3;
    el.spin.value = SPIN_VALUES.indexOf(p.spin);
    el.anti.checked = !!(p.useAnti && p.anti);
    sync(false);
    el.preset.value = id;
    applying = false;
  }
  el.preset.addEventListener('change', () => applyPreset(el.preset.value));
  el.reset.addEventListener('click', () => {
    el.mass.value = 0; el.charge.value = 3; el.spin.value = 0; el.energy.value = 0; el.anti.checked = false;
    sync(false); el.preset.value = '';
  });

  /* ---------- state & sync ---------- */
  function getState() {
    const v = +el.mass.value, ev = +el.energy.value;
    return { v, m: massFromV(v), qt: CHARGE_THIRDS[+el.charge.value], spin: SPIN_VALUES[+el.spin.value],
      anti: el.anti.checked, ev, gamma: Math.pow(10, ev / 50) };
  }

  function sync(manual) {
    const s = getState();
    if (manual && !applying) el.preset.value = '';
    $('mass-val').textContent = fmtMass(s.m);
    $('charge-val').textContent = fmtCharge(s.qt) + ' e';
    $('spin-val').textContent = fmtSpin(s.spin) + ' ħ';
    $('energy-val').textContent = 'γ = ' + s.gamma.toFixed(s.gamma < 10 ? 2 : 1);

    const state = analyze(s);
    s.colorCharged = !!state.colorCharged;
    const coreHex = state.colorCharged ? CHROMATIC_HEX : (s.qt !== 0 ? chargeHex(s.qt) : COLOR_HEX);
    document.documentElement.style.setProperty('--accent', '#' + coreHex.toString(16).padStart(6, '0'));
    Scene.set({ mass01: s.v / 1000, energy01: s.ev / 100, spin: s.spin, qt: s.qt, colorHex: coreHex, chargeHex: chargeHex(s.qt), gamma: s.gamma });
    renderCard(s, state);
  }

  function renderCard(s, A) {
    const gamma = s.gamma, beta = Math.sqrt(1 - 1 / (gamma * gamma));
    const E = s.m === 0 ? gamma * 1 : gamma * s.m;            // massless: nominal 1 MeV x gamma
    const p = Math.sqrt(Math.max(E * E - s.m * s.m, 0));
    const known = A.status === 'known';
    let tauLine;
    if (A.tau === null && !A.chText && known) tauLine = 'hadronizes / confined';
    else tauLine = fmtTau(A.tau);
    const lab = (typeof A.tau === 'number' && isFinite(A.tau)) ? fmtTau(A.tau * gamma) : null;

    let h = `<div class="badge ${known ? 'known' : 'hyp'}">${known ? 'Standard Model · Known particle' : 'Hypothetical / Undiscovered Particle'}</div>`;
    h += `<h2>${A.name}<span class="sym">${A.sym}</span></h2>`;
    h += `<div class="chips"><span class="chip">${A.cls}</span></div>`;
    h += `<div class="sec">Interactions</div><div>${A.forces.join(' · ')}${A.mediates ? `<br><span style="color:var(--dim)">Mediates:</span> ${A.mediates}` : ''}</div>`;
    h += `<div class="sec">Quantum numbers &amp; kinematics</div><div class="kv">`
      + `<span>Rest mass</span><span>${fmtMass(s.m)}</span>`
      + `<span>Charge</span><span>${fmtCharge(s.qt)} e</span>`
      + `<span>Spin</span><span>${fmtSpin(s.spin)} ħ</span>`
      + `<span>Color charge</span><span>${colorName(s)}</span>`
      + `<span>γ / β</span><span>${gamma.toFixed(2)} / ${s.m === 0 ? '1 (c)' : beta.toFixed(4)}</span>`
      + `<span>Energy${s.m === 0 ? ' (ref.)' : ''}</span><span>${fmtE(E)}</span>`
      + `<span>Momentum</span><span>${fmtE(p)}/c</span>`
      + (s.m > 0 ? `<span>Compton λ</span><span>${fmtLen(HBARC / s.m)}</span>` : '')
      + `<span>Lorentz contraction</span><span>×${(1 / gamma).toFixed(3)}</span></div>`;
    h += `<div class="sec">Stability</div><div class="kv"><span>Rest lifetime</span><span>${tauLine}</span>${lab ? `<span>Lab (γτ)</span><span>${lab}</span>` : ''}</div>`;
    h += `<div style="margin-top:4px">${known ? A.lifeText : A.chText}</div>`;
    h += `<div class="sec">Physics checks</div><ul class="warns">${A.warns.map(([lv, t]) => `<li class="${lv}">${t}</li>`).join('')}</ul>`;
    el.card.innerHTML = h;
  }

  /* ---------- input handling (snap only while dragging the mass slider) ---------- */
  let dragging = false, shift = false;
  el.mass.addEventListener('pointerdown', () => { dragging = true; });
  window.addEventListener('pointerup', () => { dragging = false; });
  el.mass.addEventListener('input', () => {
    let v = +el.mass.value;
    if (dragging && !shift) {
      if (v <= 5) v = 0;
      else { let best = null; for (const l of LANDMARKS) { const d = Math.abs(v - l.v); if (d <= 9 && (!best || d < best.d)) best = { d, v: l.v }; } if (best) v = best.v; }
      el.mass.value = v;
    }
    sync(true);
  });
  for (const k of ['charge', 'spin', 'energy']) el[k].addEventListener('input', () => sync(true));
  el.anti.addEventListener('change', () => sync(true));

  window.addEventListener('keydown', e => {
    if (e.key === 'Shift') shift = true;
    if ((e.key === 'h' || e.key === 'H') && !/SELECT|INPUT/.test((e.target.tagName || ''))) document.body.classList.toggle('nohud');
  });
  window.addEventListener('keyup', e => { if (e.key === 'Shift') shift = false; });
  $('hudToggle').addEventListener('click', () => document.body.classList.toggle('nohud'));

  const updateRangeFill = input => input.style.setProperty('--track-fill', `${(input.value - input.min) / (input.max - input.min) * 100}%`);
  for (const input of [el.mass, el.charge, el.spin, el.energy]) {
    updateRangeFill(input);
    input.addEventListener('input', () => updateRangeFill(input));
  }
  sync(false);
})();
