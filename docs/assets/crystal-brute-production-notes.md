# Crystal Brute production notes

## Approved concept prompt

> Create a production-ready multi-view character reference sheet for a stylized low-poly 3D browser game enemy. Original character: a compact crystal-corrupted brute, a simple humanoid biped approximately 1.8 meters tall. Stocky readable proportions with broad shoulders, slightly oversized forearms, hands, and boots; compact backward-curving horns; angular masked face; glowing magenta eyes; charcoal and deep-purple armor-like hide. Include only one small flush magenta crystal emblem embedded in the center of the chest and a matching flat diamond-shaped plate on the upper back. No other crystals or spikes. Strong unmistakable hostile silhouette for a distant top-down camera, while remaining easy for image-to-3D reconstruction, automatic rigging, and walk/attack/death animation. Use smooth connected body forms, clear joints, no intersecting decorations. Neutral A-pose with arms angled about 25 degrees away from the torso, straight legs, feet flat and parallel, simple mitten-like hands with one visible thumb. Show the exact same character at the exact same scale in four clean full-body views arranged left to right: front, right profile, back, and front three-quarter. Orthographic technical character turnaround, every foot and horn fully visible, centered in equal panels, flat neutral studio lighting, plain pale gray background, no cast shadows. Keep anatomy, colors, armor panels, horn shape, chest emblem, and back plate consistent across every view. No weapon, no shoulder spikes, no cape, no robe, no loose cloth, no floating parts, no pedestal, no environment, no action pose, no extra faces or limbs, no text, no labels, no watermark. This is an input reference for Meshy multi-view image-to-3D, not concept art or a promotional render.

The approved turnaround is `evidence/crystal-brute-turnaround.png`. The front, back, and right images are isolated modeling inputs derived from that sheet.

## Meshy route

- Provider: Meshy web workspace
- Source task: `01a009c6-b235-711d-8c7e-4f921aff4bdf`
- Texture task: `01a009cc-8d29-71f7-ab28-e763c70cd71b`
- Remesh task: `01a009d1-3f50-72ea-85c6-133881e1b5f5`
- Generation: Meshy 7 High Detail image-to-3D from the isolated multi-view inputs
- Original result: 1,954,104 faces and 977,054 vertices
- Texture: Meshy 7, PBR enabled
- Remesh: fixed count, triangle topology, requested 10K, 0 credits
- Downloaded result: 10,188 triangles, 7,306 vertices, one mesh, one material, three embedded PNG textures, no rig, and no animation clips
- Credit use: 20 generation + 10 texture + 0 remesh = 30 credits
- Export: GLB, requested bottom origin; the runtime adapter still measures and normalizes the feet to zero because the mesh accessor is centered
- Downloaded SHA-256: `32541174e2d4bc50942fb8346748ca140c1bc1adccc4d3cdc55556ce258a75df`

## License evidence

The asset was generated while the account was on Meshy's Free plan. The Meshy workspace showed `CC BY 4.0` for this model. Meshy's current help page states that Free-plan assets use CC BY 4.0 and need attribution, even when used commercially: <https://help.meshy.ai/en/articles/9992001-can-i-use-meshy-assets-commercially-license-copyright-explained>.

Required attribution: `Model created with Meshy – CC BY 4.0 License`.

The later Pro upgrade enabled the download. It does not change the recorded creation-time license for this asset.

## Meshy humanoid rig and locomotion

- Rigging route: Meshy web workspace, Humanoid character type, automatic joint markers reviewed before submission
- Character height entered in Meshy: 1.7 m; runtime adapter normalizes the result to 1.8 world units
- Credit use: 0 credits; the account balance remained at 1,100 before and after the web rig task
- Download archive: `Meshy_AI_Obsidian_Warhorn_biped.zip`
- Shipping animated export: `public/assets/enemies/crystal-brute-animated.glb`
- Animated SHA-256: `18fc8b237cbd978ffabdd9bb68d5d6d5ea0f9632b577e9e8ad674d5ea9bdafd0`
- Animated result: 10,188 triangles, 7,308 vertices, one mesh, one material, one skin, and two embedded 2048 by 2048 PNG textures
- Included clips: `Walking` and `Running`; the game uses `Walking`
- The walk loops in place. Enemy travel remains owned by the outer `EnemyVisual` gameplay root.
- The original static V3 GLB remains as the first fallback, followed by the procedural enemy.

The Meshy rig stores centimeter-based bones under an armature root scaled to `0.01`. The Three.js adapter must update the cloned world matrices before measuring bounds and must multiply, not replace, the model root scale. This preserves the skeleton's unit conversion while normalizing the visible character height.

## Remaining limits

The authored walk now replaces the former root-level walk bob for the generated model. Existing root-level attack, hit, and death feedback remains in code because this tutorial iteration adds locomotion only. The asset must not be called production-ready until the remaining DCC and formal performance gates pass.
