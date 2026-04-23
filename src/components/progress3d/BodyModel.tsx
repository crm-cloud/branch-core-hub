import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarSnapshot } from '@/lib/measurements/measurementToAvatar';

interface BodyModelProps {
  snapshot: AvatarSnapshot;
  interactiveRotationY: number;
  autoRotate?: boolean;
}

const SKIN_TONE = new THREE.Color('hsl(28 55% 70%)');
const MUSCLE_TONE = new THREE.Color('hsl(20 60% 58%)');
const HAIR_TONE = new THREE.Color('hsl(25 30% 20%)');

const skinMaterial = new THREE.MeshStandardMaterial({
  color: SKIN_TONE,
  roughness: 0.55,
  metalness: 0.04,
});

const muscleAccentMaterial = new THREE.MeshStandardMaterial({
  color: MUSCLE_TONE,
  roughness: 0.5,
  metalness: 0.05,
  transparent: true,
  opacity: 0.92,
});

const hairMaterial = new THREE.MeshStandardMaterial({
  color: HAIR_TONE,
  roughness: 0.7,
  metalness: 0.05,
});

const trunkMaterial = new THREE.MeshStandardMaterial({
  color: new THREE.Color('hsl(220 22% 22%)'),
  roughness: 0.6,
  metalness: 0.1,
});

export function BodyModel({ snapshot, interactiveRotationY, autoRotate = true }: BodyModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const autoRotation = useRef(0);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (autoRotate) autoRotation.current += delta * 0.18;
    groupRef.current.rotation.y = autoRotation.current + interactiveRotationY;
  });

  const proportions = useMemo(() => {
    const { morphs, genderPresentation } = snapshot;
    const isFemale = genderPresentation === 'female';
    const isMale = genderPresentation === 'male';
    const hipBias = isFemale ? 0.1 : isMale ? -0.02 : 0.03;
    const shoulderBias = isMale ? 0.06 : isFemale ? -0.04 : 0;
    const muscleVisibility = Math.max(0, (morphs.shoulderBreadth + morphs.armVolume + morphs.chestVolume) / 3 - 0.42);

    return {
      isFemale,
      isMale,
      bodyHeight: 1.78 + (morphs.heightScale - 0.5) * 0.5,
      torsoWidth: 0.6 + (morphs.torsoWidth - 0.5) * 0.3 + shoulderBias * 0.2,
      chestDepth: 0.32 + (morphs.chestVolume - 0.5) * 0.18,
      waistWidth: 0.42 + (morphs.waistWidth - 0.5) * 0.22 + (isFemale ? -0.04 : 0),
      abdomenDepth: 0.22 + (morphs.abdomenVolume - 0.5) * 0.16,
      hipWidth: 0.5 + (morphs.hipWidth - 0.5) * 0.28 + hipBias,
      shoulderWidth: 0.86 + (morphs.shoulderBreadth - 0.5) * 0.46 + shoulderBias,
      armRadius: 0.085 + (morphs.armVolume - 0.5) * 0.05,
      forearmRadius: 0.07 + (morphs.forearmVolume - 0.5) * 0.04,
      wristRadius: 0.045 + (morphs.wristSize - 0.5) * 0.02,
      thighRadius: 0.12 + (morphs.thighVolume - 0.5) * 0.07,
      calfRadius: 0.09 + (morphs.calfVolume - 0.5) * 0.05,
      ankleRadius: 0.05 + (morphs.ankleSize - 0.5) * 0.02,
      neckRadius: 0.085 + (morphs.neckSize - 0.5) * 0.03,
      torsoHeight: 0.7 + (morphs.torsoLength - 0.5) * 0.18,
      softness: 0.025 + morphs.bodyFatSoftness * 0.03,
      muscleVisibility,
    };
  }, [snapshot]);

  const showMuscleDef = proportions.muscleVisibility > 0.04;
  const muscleOpacity = Math.min(1, 0.55 + proportions.muscleVisibility * 1.4);

  return (
    <group ref={groupRef} position={[0, -1.45, 0]}>
      {/* Head */}
      <group position={[0, proportions.bodyHeight + 0.05, 0]}>
        <mesh material={skinMaterial}>
          <sphereGeometry args={[0.16, 32, 32]} />
        </mesh>
        {/* Hair cap */}
        <mesh position={[0, 0.06, -0.01]} material={hairMaterial} scale={[1.04, 0.7, 1.04]}>
          <sphereGeometry args={[0.16, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>

      {/* Neck */}
      <mesh position={[0, proportions.bodyHeight - 0.08, 0]} material={skinMaterial}>
        <cylinderGeometry args={[proportions.neckRadius, proportions.neckRadius * 1.1, 0.16, 20]} />
      </mesh>

      {/* Trapezius / shoulder yoke */}
      <mesh
        position={[0, proportions.bodyHeight - 0.18, 0]}
        material={skinMaterial}
        scale={[proportions.shoulderWidth / 0.86, 0.45, 0.7]}
      >
        <sphereGeometry args={[0.32, 28, 20]} />
      </mesh>

      {/* Upper torso (rib cage / chest) */}
      <mesh
        position={[0, proportions.bodyHeight - 0.45, 0]}
        material={skinMaterial}
        scale={[proportions.torsoWidth / 0.6, 1, proportions.chestDepth / 0.32]}
      >
        <capsuleGeometry args={[0.3 + proportions.softness, proportions.torsoHeight * 0.5, 14, 24]} />
      </mesh>

      {/* Pectorals (male) or chest contour (female) */}
      {proportions.isFemale ? (
        <>
          {[-1, 1].map((side) => (
            <mesh
              key={`bust-${side}`}
              position={[
                side * (proportions.torsoWidth * 0.28),
                proportions.bodyHeight - 0.5,
                proportions.chestDepth * 0.55,
              ]}
              material={skinMaterial}
            >
              <sphereGeometry args={[0.11 + proportions.softness, 22, 18]} />
            </mesh>
          ))}
        </>
      ) : (
        showMuscleDef && (
          <>
            {[-1, 1].map((side) => (
              <mesh
                key={`pec-${side}`}
                position={[
                  side * (proportions.torsoWidth * 0.22),
                  proportions.bodyHeight - 0.42,
                  proportions.chestDepth * 0.55,
                ]}
                rotation={[0, 0, side * 0.15]}
                material={new THREE.MeshStandardMaterial({
                  color: MUSCLE_TONE,
                  roughness: 0.5,
                  transparent: true,
                  opacity: muscleOpacity,
                })}
                scale={[1.1, 0.7, 0.55]}
              >
                <sphereGeometry args={[0.13, 20, 16]} />
              </mesh>
            ))}
          </>
        )
      )}

      {/* Abdomen / waist */}
      <mesh
        position={[0, proportions.bodyHeight - 0.85, 0]}
        material={skinMaterial}
        scale={[proportions.waistWidth / 0.42, 1, proportions.abdomenDepth / 0.22]}
      >
        <capsuleGeometry args={[0.2 + proportions.softness, 0.32, 12, 22]} />
      </mesh>

      {/* Abs (only when muscular & not female-soft) */}
      {showMuscleDef && !proportions.isFemale && (
        <group position={[0, proportions.bodyHeight - 0.78, proportions.abdomenDepth * 0.65]}>
          {[0, 1, 2].map((row) => (
            <group key={`ab-row-${row}`} position={[0, -row * 0.09, 0]}>
              {[-1, 1].map((side) => (
                <mesh
                  key={`ab-${row}-${side}`}
                  position={[side * 0.045, 0, 0]}
                  material={new THREE.MeshStandardMaterial({
                    color: MUSCLE_TONE,
                    roughness: 0.5,
                    transparent: true,
                    opacity: muscleOpacity * 0.85,
                  })}
                >
                  <boxGeometry args={[0.06, 0.06, 0.025]} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      )}

      {/* Hips / pelvis */}
      <mesh
        position={[0, proportions.bodyHeight - 1.18, 0]}
        material={skinMaterial}
        scale={[proportions.hipWidth / 0.5, 0.7, 0.95]}
      >
        <sphereGeometry args={[0.28, 28, 22]} />
      </mesh>

      {/* Trunks / underwear band */}
      <mesh
        position={[0, proportions.bodyHeight - 1.22, 0]}
        material={trunkMaterial}
        scale={[proportions.hipWidth / 0.5, 0.55, 0.95]}
      >
        <cylinderGeometry args={[0.28, 0.28, 0.18, 28, 1, true]} />
      </mesh>

      {/* Arms */}
      {[-1, 1].map((side) => (
        <group
          key={`arm-${side}`}
          position={[side * (proportions.shoulderWidth * 0.5), proportions.bodyHeight - 0.22, 0]}
        >
          {/* Deltoid */}
          <mesh material={skinMaterial}>
            <sphereGeometry args={[proportions.armRadius * 1.55, 18, 14]} />
          </mesh>
          {/* Biceps / upper arm */}
          <group position={[side * 0.05, -0.32, 0]} rotation={[0, 0, side * 0.1]}>
            <mesh material={skinMaterial}>
              <capsuleGeometry args={[proportions.armRadius + proportions.softness / 2, 0.36, 12, 18]} />
            </mesh>
            {showMuscleDef && (
              <mesh
                position={[0, 0, proportions.armRadius * 0.6]}
                material={new THREE.MeshStandardMaterial({
                  color: MUSCLE_TONE,
                  roughness: 0.5,
                  transparent: true,
                  opacity: muscleOpacity * 0.9,
                })}
                scale={[0.6, 0.9, 0.4]}
              >
                <sphereGeometry args={[proportions.armRadius * 1.1, 16, 12]} />
              </mesh>
            )}
          </group>
          {/* Forearm */}
          <mesh
            position={[side * 0.07, -0.74, 0]}
            rotation={[0, 0, side * -0.05]}
            material={skinMaterial}
          >
            <capsuleGeometry args={[proportions.forearmRadius, 0.42, 10, 16]} />
          </mesh>
          {/* Hand */}
          <mesh position={[side * 0.07, -1.05, 0]} material={skinMaterial}>
            <sphereGeometry args={[proportions.wristRadius * 1.6, 14, 12]} />
          </mesh>
        </group>
      ))}

      {/* Legs */}
      {[-1, 1].map((side) => (
        <group
          key={`leg-${side}`}
          position={[side * (proportions.hipWidth * 0.42), proportions.bodyHeight - 1.4, 0]}
        >
          {/* Thigh */}
          <mesh material={skinMaterial}>
            <capsuleGeometry args={[proportions.thighRadius + proportions.softness / 3, 0.7, 14, 22]} />
          </mesh>
          {/* Knee */}
          <mesh position={[0, -0.55, 0.02]} material={skinMaterial}>
            <sphereGeometry args={[proportions.thighRadius * 0.78, 16, 14]} />
          </mesh>
          {/* Calf */}
          <mesh position={[0, -0.88, 0]} material={skinMaterial}>
            <capsuleGeometry args={[proportions.calfRadius, 0.6, 12, 18]} />
          </mesh>
          {/* Foot */}
          <mesh position={[0, -1.28, 0.06]} material={trunkMaterial}>
            <boxGeometry args={[proportions.ankleRadius * 2.6, proportions.ankleRadius * 1.1, proportions.ankleRadius * 4.2]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
