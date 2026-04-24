# 3D Avatar Models

Drop your GLB files here to enable real anatomical avatars in the Member 3D Body view:

- `avatar-male.glb` — male presentation
- `avatar-female.glb` — female presentation

When these files are absent, the app automatically falls back to the procedural
`BodyModel` (capsule-based silhouette) — no errors, no broken UI.

## Recommended morph target names

For the avatar to react to body measurements, the GLB should expose these
morph targets (any subset works; missing keys are ignored):

`heightScale, torsoLength, torsoWidth, chestVolume, waistWidth, abdomenVolume,
hipWidth, shoulderBreadth, armVolume, forearmVolume, wristSize, thighVolume,
calfVolume, ankleSize, neckSize, bodyFatSoftness`

Tools that work well:
- Ready Player Me (`https://readyplayer.me`) — free avatars with morph targets.
- Mixamo / MakeHuman exports (rebake morphs to match the names above).
- Custom Blender export with shape keys.
