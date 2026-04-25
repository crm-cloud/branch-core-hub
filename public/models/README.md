# 3D Avatar GLB Assets

Drop production-ready GLB avatars here so `AvatarGltf` will use them automatically.

## Expected files

```
public/models/avatar-male.glb
public/models/avatar-female.glb
```

If a file is missing, the component silently falls back to the procedural
`BodyModel` — no errors, no broken UI.

## Recommended sources

- **Ready Player Me** (https://readyplayer.me) — free avatar exports with
  ARKit-style morph targets.
- **Mixamo** + custom blendshapes — character-rig friendly.
- Any GLB with morph target dictionaries works.

## Morph target naming

The 3D body adapter (`measurementToAvatar`) emits these snapshot keys:

- `waistWidth`
- `chestVolume`
- `hipWidth`
- `armBicep`
- `thighGirth`
- `bodyFat`

`AvatarGltf` looks for matching morph target names on the mesh
(`mesh.morphTargetDictionary`). It also tries the following common
aliases automatically:

| snapshot key  | aliases tried                          |
|---------------|----------------------------------------|
| waistWidth    | Waist, waist, viseme_Waist             |
| chestVolume   | Chest, chest, ChestSize                |
| hipWidth      | Hip, hips, Hips                        |
| armBicep      | Arm, Bicep, biceps                     |
| thighGirth    | Thigh, thighs, Thighs                  |
| bodyFat       | BodyFat, body_fat, Fat                 |

Morph keys that aren't present on the mesh are silently ignored.

## Performance

- Keep models under ~5 MB each — they are loaded into the browser.
- Bake textures, decimate meshes, and use Draco compression if possible.
- The component caches the HEAD probe per URL so the network only sees
  one request per file per session.
