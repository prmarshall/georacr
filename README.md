# georacr

A browser-based 3D driving game built with React and Three.js. Drive vehicles across real-world photogrammetric terrain powered by OGC 3D Tiles.

## Features

- **Multiple vehicles** -- Sedan (FWD), Sports Car (RWD), Tractor (RWD), each with distinct handling characteristics
- **Realistic vehicle physics** -- Rapier's `DynamicRayCastVehicleController` with engine force, gearbox, air drag, rolling resistance, handbrake drifting, tire load sensitivity, and friction circle model
- **3D Tiles terrain** -- Drive on real photogrammetric meshes loaded via the OGC 3D Tiles standard. Currently using NASA's Dingo Gap Mars dataset (Curiosity rover). Supports Google Photorealistic Tiles and Cesium Ion.
- **Trimesh collision** -- Per-triangle physics colliders extracted from tile meshes with automatic LOD tracking
- **Chase camera** -- GTA5-style follow cam with mouse orbit override and pointer lock
- **HUD** -- Speedometer (mph/km/h), stopwatch, and 0-60 mph timer

## Tech Stack

| Layer     | Technology                         |
| --------- | ---------------------------------- |
| Framework | React 19 + TypeScript              |
| Bundler   | Vite                               |
| 3D Engine | Three.js + React Three Fiber (R3F) |
| Physics   | Rapier (via @react-three/rapier)   |
| 3D Tiles  | 3d-tiles-renderer (NASA-AMMOS)     |
| Helpers   | @react-three/drei                  |
| Styling   | SCSS Modules                       |

## Integrations

- **[3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS)** -- Loads and renders OGC 3D Tiles tilesets with automatic LOD, DRACO mesh decompression, and R3F bindings
- **[Rapier](https://rapier.rs/)** -- WASM physics engine providing rigid body dynamics, raycast vehicle controller, and trimesh colliders
- **[NASA Dingo Gap dataset](https://github.com/NASA-AMMOS/3DTilesSampleData)** -- Mars terrain captured by the Curiosity rover, served as 3D Tiles from GitHub
- **Google Photorealistic 3D Tiles** -- Supported but currently disabled. Requires a Google Cloud API key (`VITE_MAP_TILES_API_TOKEN`)

## Getting Started

```bash
npm install
npm run dev
```

## Controls

| Key                    | Action                    |
| ---------------------- | ------------------------- |
| W / Arrow Up           | Accelerate                |
| S / Arrow Down         | Brake / Reverse           |
| A/D / Arrow Left/Right | Steer                     |
| Space                  | Handbrake                 |
| R                      | Reset vehicle             |
| Click                  | Mouse look (pointer lock) |
| Escape                 | Release mouse             |
