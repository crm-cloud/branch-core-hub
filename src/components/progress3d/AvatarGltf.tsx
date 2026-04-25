import { Suspense, useEffect, useMemo, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { BodyModel } from './BodyModel';
import type { AvatarSnapshot } from '@/lib/measurements/measurementToAvatar';

/**
 * AvatarGltf — loads a real GLB avatar (with morph targets) when available,
 * otherwise falls back to the procedural BodyModel.
 *
 * Drop your GLB files at:
 *   public/models/avatar-male.glb
 *   public/models/avatar-female.glb
 *
 * Recommended: use Ready Player Me / Mixamo exports with these morph target names
 * matching `AvatarSnapshot.morphs` keys (waistWidth, chestVolume, hipWidth, etc.).
 * Any morph keys not present on the mesh are silently ignored.
 */

interface AvatarGltfProps {
  snapshot: AvatarSnapshot;
  interactiveRotationY: number;
}

const MODEL_URLS: Record<'male' | 'female' | 'neutral', string> = {
  male: '/models/avatar-male.glb',
  female: '/models/avatar-female.glb',
  neutral: '/models/avatar-male.glb',
};

/** Cached HEAD probe — only one network hit per URL per session. */
const availabilityCache = new Map<string, Promise<boolean>>();
function probeAvailability(url: string) {
  if (!availabilityCache.has(url)) {
    availabilityCache.set(
      url,
      fetch(url, { method: 'HEAD' }).then((r) => r.ok).catch(() => false),
    );
  }
  return availabilityCache.get(url)!;
}

function useGltfAvailability(url: string) {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    probeAvailability(url).then((ok) => { if (!cancelled) setAvailable(ok); });
    return () => { cancelled = true; };
  }, [url]);
  return available;
}

/** Common morph-target name aliases for Ready Player Me / Mixamo / custom rigs. */
const MORPH_ALIASES: Record<string, string[]> = {
  waistWidth: ['Waist', 'waist', 'viseme_Waist'],
  chestVolume: ['Chest', 'chest', 'ChestSize'],
  hipWidth: ['Hip', 'hips', 'Hips'],
  armBicep: ['Arm', 'Bicep', 'biceps'],
  thighGirth: ['Thigh', 'thighs', 'Thighs'],
  bodyFat: ['BodyFat', 'body_fat', 'Fat'],
};

function findMorphIndex(dict: Record<string, number>, key: string): number | undefined {
  if (typeof dict[key] === 'number') return dict[key];
  for (const alias of MORPH_ALIASES[key] || []) {
    if (typeof dict[alias] === 'number') return dict[alias];
  }
  return undefined;
}

function GltfMesh({ url, snapshot, interactiveRotationY }: { url: string } & AvatarGltfProps) {
  const { scene } = useGLTF(url);

  const cloned = useMemo(() => scene.clone(true), [scene]);

  useEffect(() => {
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh & { morphTargetDictionary?: Record<string, number>; morphTargetInfluences?: number[] };
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      Object.entries(snapshot.morphs).forEach(([key, value]) => {
        const idx = findMorphIndex(mesh.morphTargetDictionary!, key);
        if (typeof idx === 'number') {
          mesh.morphTargetInfluences![idx] = Math.max(0, Math.min(1, value));
        }
      });
    });
  }, [cloned, snapshot]);

  return (
    <primitive
      object={cloned}
      rotation-y={interactiveRotationY}
      position={[0, -1.45, 0]}
    />
  );
}

export function AvatarGltf({ snapshot, interactiveRotationY }: AvatarGltfProps) {
  const url = MODEL_URLS[snapshot.genderPresentation];
  const available = useGltfAvailability(url);

  if (available === null) {
    // Probing — render fallback to avoid a flash of nothing.
    return <BodyModel snapshot={snapshot} interactiveRotationY={interactiveRotationY} />;
  }

  if (!available) {
    return <BodyModel snapshot={snapshot} interactiveRotationY={interactiveRotationY} />;
  }

  return (
    <Suspense fallback={<BodyModel snapshot={snapshot} interactiveRotationY={interactiveRotationY} />}>
      <GltfMesh url={url} snapshot={snapshot} interactiveRotationY={interactiveRotationY} />
    </Suspense>
  );
}

// Pre-warm cache hints — only hit if files exist (useGLTF.preload is best-effort).
// Commented out by default to avoid 404 noise; uncomment after you ship GLB assets:
// useGLTF.preload('/models/avatar-male.glb');
// useGLTF.preload('/models/avatar-female.glb');
