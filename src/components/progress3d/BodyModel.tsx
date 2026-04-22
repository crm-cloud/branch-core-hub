import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarSnapshot } from '@/lib/measurements/measurementToAvatar';

interface BodyModelProps {
  snapshot: AvatarSnapshot;
  interactiveRotationY: number;
  autoRotate?: boolean;
}

const torsoMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('hsl(24 95% 53%)'),
  roughness: 0.5,
  metalness: 0.1,
});

const limbMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('hsl(222 47% 11%)'),
  roughness: 0.65,
  metalness: 0.08,
});

const accentMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('hsl(210 40% 98%)'),
  roughness: 0.35,
  metalness: 0.15,
});

export function BodyModel({ snapshot, interactiveRotationY, autoRotate = true }: BodyModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const autoRotation = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (autoRotate) autoRotation.current += delta * 0.22;
    groupRef.current.rotation.y = autoRotation.current + interactiveRotationY;
  });

  const proportions = useMemo(() => {
    const { morphs, genderPresentation } = snapshot;
    const genderBias = genderPresentation === 'female' ? 0.08 : genderPresentation === 'male' ? -0.02 : 0;

    return {
      bodyHeight: 1.75 + (morphs.heightScale - 0.5) * 0.55,
      torsoWidth: 0.62 + (morphs.torsoWidth - 0.5) * 0.34,
      chestDepth: 0.34 + (morphs.chestVolume - 0.5) * 0.22,
      waistWidth: 0.46 + (morphs.waistWidth - 0.5) * 0.24,
      abdomenDepth: 0.24 + (morphs.abdomenVolume - 0.5) * 0.18,
      hipWidth: 0.56 + (morphs.hipWidth - 0.5) * (0.3 + genderBias),
      shoulderWidth: 0.8 + (morphs.shoulderBreadth - 0.5) * 0.5,
      armRadius: 0.085 + (morphs.armVolume - 0.5) * 0.05,
      forearmRadius: 0.07 + (morphs.forearmVolume - 0.5) * 0.04,
      wristRadius: 0.045 + (morphs.wristSize - 0.5) * 0.02,
      thighRadius: 0.12 + (morphs.thighVolume - 0.5) * 0.07,
      calfRadius: 0.09 + (morphs.calfVolume - 0.5) * 0.05,
      ankleRadius: 0.05 + (morphs.ankleSize - 0.5) * 0.02,
      neckRadius: 0.085 + (morphs.neckSize - 0.5) * 0.03,
      torsoHeight: 0.68 + (morphs.torsoLength - 0.5) * 0.18,
      softness: 0.03 + morphs.bodyFatSoftness * 0.03,
      massOffset: (morphs.globalMass - 0.5) * 0.08,
    };
  }, [snapshot]);

  return (
    <group ref={groupRef} position={[0, -1.45, 0]}>
      {/* TODO: Replace this sculpted placeholder with gendered GLB models from /public/models/body-male.glb and /public/models/body-female.glb */}
      {/* TODO: Map morphs to actual GLB blend shape names once production body assets are available */}
      <mesh position={[0, proportions.bodyHeight + 0.08, 0]} material={accentMaterial}>
        <sphereGeometry args={[0.18 + proportions.massOffset, 32, 32]} />
      </mesh>

      <mesh position={[0, proportions.bodyHeight * 0.72, 0]} material={torsoMaterial}>
        <capsuleGeometry args={[proportions.torsoWidth / 2 + proportions.softness, proportions.torsoHeight, 12, 24]} />
        <scale args={[1, 1.05, proportions.chestDepth / 0.34]} />
      </mesh>

      <mesh position={[0, proportions.bodyHeight * 0.53, proportions.abdomenDepth * 0.12]} material={torsoMaterial}>
        <capsuleGeometry args={[proportions.waistWidth / 2 + proportions.softness, 0.34, 12, 20]} />
        <scale args={[1, 1, proportions.abdomenDepth / 0.24]} />
      </mesh>

      <mesh position={[0, proportions.bodyHeight * 0.35, 0]} material={torsoMaterial}>
        <sphereGeometry args={[proportions.hipWidth / 2, 32, 32]} />
        <scale args={[1, 0.8, 0.92]} />
      </mesh>

      <mesh position={[0, proportions.bodyHeight * 0.98, 0]} material={accentMaterial}>
        <cylinderGeometry args={[proportions.neckRadius, proportions.neckRadius, 0.18, 20]} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={`arm-${side}`} position={[side * proportions.shoulderWidth * 0.5, proportions.bodyHeight * 0.78, 0]}>
          <mesh rotation={[0, 0, side * 0.08]} material={limbMaterial}>
            <capsuleGeometry args={[proportions.armRadius + proportions.softness / 2, 0.6, 10, 18]} />
          </mesh>
          <mesh position={[0, -0.5, 0]} rotation={[0, 0, side * -0.08]} material={limbMaterial}>
            <capsuleGeometry args={[proportions.forearmRadius, 0.55, 10, 18]} />
          </mesh>
          <mesh position={[0, -0.95, 0]} material={accentMaterial}>
            <sphereGeometry args={[proportions.wristRadius * 1.3, 16, 16]} />
          </mesh>
        </group>
      ))}

      {[-1, 1].map((side) => (
        <group key={`leg-${side}`} position={[side * 0.18, proportions.bodyHeight * 0.18, 0]}>
          <mesh material={limbMaterial}>
            <capsuleGeometry args={[proportions.thighRadius + proportions.softness / 3, 0.75, 12, 20]} />
          </mesh>
          <mesh position={[0, -0.72, 0]} material={limbMaterial}>
            <capsuleGeometry args={[proportions.calfRadius, 0.72, 12, 20]} />
          </mesh>
          <mesh position={[0, -1.15, 0.05]} material={accentMaterial}>
            <boxGeometry args={[proportions.ankleRadius * 3.2, proportions.ankleRadius * 1.2, proportions.ankleRadius * 4.4]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
