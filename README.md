# Quantum Particle Lab

Interactive 3D "blank particle" character creator for the Standard Model.
Vanilla HTML/CSS/JS + Three.js r147 from a CDN. No build step.

## Run
1. Unzip.
2. Open `index.html` in a browser (Chrome, Edge, Firefox). Needs internet once for the Three.js CDN.

If your browser blocks anything on `file://`, run `python3 -m http.server` in this folder and open http://localhost:8000.

## Controls
- Drag: orbit. Wheel: zoom.
- Mass slider snaps to landmarks while dragging. Hold Shift to bypass; arrow keys never snap.
- Click a tick label to jump to it. `H` hides the HUD.
- "Antiparticle / anti-color" flips color sign (quarks) and neutrino vs antineutrino.

## Files
- `js/data.js`     Standard Model catalogue and slider mappings
- `js/physics.js`  identification, spin/color/charge checks, decay estimates
- `js/scene.js`    Three.js scene and shaders
- `js/main.js`     HUD, ticks, presets, glue

## Caveats
- Neutrino masses are 0 (SM convention); flavor cannot be set from these sliders.
- Lorentz contraction is shown as 1/gamma, clamped at x0.1 visually.
- Hypothetical lifetimes are order-of-magnitude estimates, not predictions.
