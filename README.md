# Defend the Crystal

A small Three.js survival game built as the playable foundation for an AI game-asset tutorial.

## Game loop

- Move the guardian with WASD or the arrow keys.
- Aim with the mouse and left-click to fire straight shots.
- Keep the crystal alive for 60 seconds.
- Enemies use the Meshy-generated Crystal Brute GLB, with the procedural geometry kept as a load-failure fallback.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, normally <http://127.0.0.1:5173/>. Do not open `index.html` directly: this project uses JavaScript modules that Vite must serve over HTTP.

## Production build

```bash
npm run build
```

## Enemy asset contract

`EnemyVisual` in `src/main.js` is the replaceable visual layer for the Crystal Brute GLB.

- Height: 1.8 world units
- Ground origin: `(0, 0, 0)` at the feet
- Forward direction: positive Z
- Collision radius: 0.55 world units
- Required states: `walk`, `attack`, `hit`, and `death`
- Current export: one static GLB; V3 keeps code-driven `walk`, `attack`, `hit`, and `death` feedback

The gameplay state, health, movement and collision data stay outside the visual group so the generated model can replace the placeholder without changing the game rules.

The complete generation route, task IDs, mesh statistics, limitations, and evidence are recorded in `docs/assets/crystal-brute.asset-production-record.json` and `docs/assets/crystal-brute-production-notes.md`.

## Asset attribution

Crystal Brute: Model created with Meshy – CC BY 4.0 License.
