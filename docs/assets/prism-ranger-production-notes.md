# Prism Ranger Production Notes

## Approved concept

- Asset name: Prism Ranger
- Role: Player character
- Approved by Alex Morris on 2026-08-16
- Selected candidate: B
- Intended checkpoint: `v5` after game integration and Alex's explicit approval

## Image-generation brief

Create an original stylized low-poly science-fantasy guardian for a browser game. Show one consistent full-body character in front, right-side, back, and three-quarter views. Use pale blue and white streamlined armor over a navy undersuit, a horizontal cyan visor, and a cyan hexagonal chest reactor. Keep the silhouette clear and game-readable. Keep the arms separated from the torso, the legs separated, the hands visible, and every limb uncropped. Use a neutral studio background. Do not include weapons, text, scenery, floor props, capes, or loose accessories.

## Meshy input files

- `docs/assets/evidence/prism-ranger-turnaround.png`: unchanged approved concept sheet
- `docs/assets/evidence/prism-ranger-front.png`: isolated front view
- `docs/assets/evidence/prism-ranger-right.png`: isolated right-side view
- `docs/assets/evidence/prism-ranger-back.png`: isolated back view

## Planned production route

1. Meshy multi-image-to-3D generation from the isolated views.
2. Inspect silhouette, hands, feet, armor continuity, and front/back agreement.
3. Use fixed-count remesh only after the source model passes inspection.
4. Use Meshy Humanoid rigging and the included `Walking` clip.
5. Export one browser-ready GLB and integrate it behind the existing procedural-player fallback.

Meshy credit use, task identifiers, export details, and technical measurements will be recorded after each completed stage.

## Completed Meshy work — 2026-08-16

- Source generation: Meshy 7 High Detail, multi-view front/back/right input, A-pose, image enhancement, private output.
- Source generation cost: 20 credits. Visible balance changed from 1,100 to 1,080.
- Source-quality result: clean humanoid silhouette, separate limbs, preserved helmet/chest/boot forms, and no visible extra geometry.
- Remesh: fixed triangle topology with an 8,000 target. Meshy later reported 8,273 faces and 4,125 vertices after Humanoid rigging.
- Remesh cost shown by Meshy: 0 credits. The visible balance changed from 1,080 to 1,130 during the task; this is recorded as an unexplained provider-side adjustment, not a known charge.
- Texture: Meshy 7 image input using the same front/back/right views, multi-view on, PBR maps on, 2K resolution.
- Texture cost: 10 credits. Visible balance changed from 1,130 to 1,120.
- Texture result: white, pale-blue, and navy armor remained readable. Meshy shifted the cyan visor and chest core slightly toward green.
- Rig: Humanoid, front-facing, centered, 1.7 metres, automatic joint markers accepted after visual inspection.
- Rig cost: no credit deduction. Visible balance remained 1,120.
- Animation: Meshy's preset named `Walking` is the default added motion. Preview showed alternating legs, arm swing, and no visible shoulder or knee breakage.
- Planned export: GLB, Rigged Character on, All Added animations, Single file on.
- Download completed as `Meshy_AI_Frostbyte_Guardian_biped.zip`, SHA-256 `155aab4ce451977b906e632c658cb0719d2fcfc8872270eae50518812f7183f5`.
- The archive contained a rigged-character GLB and a merged-animation GLB. The merged file was selected because it contains clips named `Running` and `Walking`.
- Shipping GLB: `public/assets/player/prism-ranger-animated.glb`, SHA-256 `1da856815671d5f49455afba438383e6b2745c46aceaf012423494c21b6f0e5f`.
- Shipping measurements: 5,014,752 bytes, 8,044 triangles, 8,030 position vertices, one mesh, one material, two textures, one embedded image, one skin, and two animation clips.
- `PlayerVisual` normalizes the model to 1.8 world units, grounds it at the feet, uses `Walking` only while the player moves, and keeps aim, fire, collision, and travel outside the asset.
- The production build passed. Browser checks proved normal GLB load, visible scale, restart, canvas firing input, and the procedural-player fallback when the GLB was temporarily unavailable.
- Remaining user check: confirm the walk during normal sustained WASD input. The in-app browser control could not hold a movement key on the canvas.
