# Project: roadglobe

## Build & Dev

- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint`

## Tech Stack

- **Framework:** React + Vite + TypeScript
- **3D Engine:** Three.js + React Three Fiber (R3F)
- **Physics:** @react-three/rapier (Raycast Vehicle)
- **Helpers:** @react-three/drei

## Guidelines

- **Component Pattern:** Use functional components. Separate `Chassis.tsx`, `Wheel.tsx`, and `Vehicle.tsx`.
- **Physics Logic:** Use Rapier's `useRaycastVehicle` hook for car dynamics rather than standard rigid body forces for wheels.
- **Math:** Use `THREE.Vector3` and `THREE.Quaternion` for all camera following and movement logic.
- **State:** Use `zustand` or simple React state for game-wide variables (speed, current street, score).

## Agentic Environment

- **Safety Hooks:** Active. `PreToolUse` blocks recursive deletes and `.env` edits.
- **Quality Gate:** `PostToolUse` triggers `tsc` and `lint --fix` on every file change.
- **Integrity:** `SubagentStop` runs `npm run build` to prevent broken code from being finalized.

## Camera System

- **View:** Third-person following camera.
- **Implementation:** Use a "Spring Arm" or lerped offset logic. Do not hard-parent the camera to the chassis mesh.
