# Defend the Crystal

A small Three.js survival game built as the playable foundation for an AI game-asset tutorial.

## Game loop

- Move the guardian with WASD or the arrow keys.
- The guardian automatically attacks the nearest creature in range.
- Keep the crystal alive for 60 seconds.
- The game currently uses procedural placeholder geometry.

## Run locally

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Enemy asset contract

`EnemyVisual` in `src/main.js` is the replaceable visual layer for the future GLB enemy.

- Height: 1.8 world units
- Ground origin: `(0, 0, 0)` at the feet
- Forward direction: positive Z
- Collision radius: 0.55 world units
- Required states: `walk`, `attack`, `hit`, and `death`
- Intended export: one GLB with a shared skeleton and named animation clips

The gameplay state, health, movement and collision data stay outside the visual group so the generated model can replace the placeholder without changing the game rules.
