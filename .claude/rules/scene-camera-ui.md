---
paths:
  - "src/App.tsx"
  - "src/components/**"
  - "src/stores/**"
---

# Scene & Rendering

- **Terrain:** 3D Tiles (see tiles-terrain rule).
- **Near plane:** `0.001` (1mm). Prevents tile bounding volumes from being clipped at low orbit altitude.
- **Logarithmic depth buffer:** `gl={{ logarithmicDepthBuffer: true }}`. Required for near/far ratio 0.001/10000.
- **Sky:** Custom `MarsSky` — `BackSide` sphere (distance 9000, within far 10000) with GLSL gradient. Vertex shader `pos.z = pos.w` forces max depth. `depthWrite={false}`, `fog={false}`. Do NOT use drei `<Sky>`.
- **Fog:** Linear `["#c8b898", 5, 250]`. Color matched to sky horizon.

# Camera (`useChaseCamera.ts`)

- **Chase cam (GTA5-style):** Follows vehicle heading via smoothed yaw. Sharp turns slow camera follow. Self-contained hook.
- **Mouse orbit:** Click for pointer lock, Escape to release. Adds azimuth/elevation offset. Decays after 1s idle.
- **Elevation:** Base 0.35 rad, inverted (mouse down = camera higher).
- **Default position:** Behind car at +Z, looking toward -Z.
- **Smoothing:** Position `1.0 - 0.01 ** delta`, yaw `1.0 - 0.02 ** delta` with `sharpTurnFactor`.

# HUD

- **HUD.tsx** orchestrates `Speedometer` + `Stopwatch`. Vehicle selector and reset button are in `App.tsx`, NOT HUD.
- **Refs vs useState:** Refs + `textContent` for per-frame values. `useState` for discrete events driving conditional render. Never read refs during render (React 19 strict mode).

# State Management (Zustand)

- **Store:** `src/stores/useDebugStore.ts`. Flat store, no nesting.
- **React components:** `useDebugStore(s => s.someFlag)` — selector subscription.
- **`useFrame` loops:** `useDebugStore.getState().someFlag` — synchronous, zero overhead.
- **Adding a toggle:** (1) Add to store, (2) Add `<ToggleRow>` to `DebugPanel.tsx`, (3) Read where needed.

# UI

- **Layout:** HUD (bottom-left), Vehicle Selector (bottom-center), Reset Button (bottom-right), Debug Panel (top-right).
- **DebugPanel:** Gear icon toggles overlay panel with debug visual toggles. Uses `UIButton`.
- **UIButton:** All overlay buttons must use `UIButton` (tabIndex=-1, preventDefault). Never use raw `<button>`.
