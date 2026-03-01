# Project: roadglobe

## Build & Dev

- Install: `npm install`
- Dev: `npm run dev`
- Lint: `npm run lint`

## Tech Stack

- React + Vite + TypeScript
- Three.js + R3F (React Three Fiber)
- Rapier (Physics)

## Guidelines

- Use Functional Components with TypeScript interfaces.
- For 3D math, prefer Three.js native classes (Vector3, Euler).
- Keep components modular (separate Player, Map, and UI).

## Agentic Environment

- **Safety Hooks:** Active. Recursive deletes and edits to `.env`/`.git` are blocked.
- **Auto-Format:** Active. Files are linted/formatted on save. No need to run lint manually.
- **Workflow:** Always verify 3D renders in the browser after a `Write` tool succeeds.
