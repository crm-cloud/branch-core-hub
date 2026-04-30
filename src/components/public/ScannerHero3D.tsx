import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Environment } from "@react-three/drei";
import * as THREE from "three";

/**
 * Stylized 3D body-scanner showcase for the public website.
 * Pure procedural geometry — no external GLB required, keeps bundle small
 * and never errors out if /models/avatar-*.glb is missing.
 */
function MannequinAvatar() {
  const group = useRef<THREE.Group>(null);
  const ringTop = useRef<THREE.Mesh>(null);
  const ringMid = useRef<THREE.Mesh>(null);
  const ringLow = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (group.current) group.current.rotation.y = t * 0.35;
    // Animated scan rings sliding up and down the body
    if (ringTop.current) ringTop.current.position.y = 1.4 + Math.sin(t * 1.2) * 0.15;
    if (ringMid.current) ringMid.current.position.y = 0.2 + Math.sin(t * 1.2 + 2) * 0.25;
    if (ringLow.current) ringLow.current.position.y = -1.2 + Math.sin(t * 1.2 + 4) * 0.2;
  });

  const bodyMat = new THREE.MeshStandardMaterial({
    color: "#1a1a24",
    metalness: 0.4,
    roughness: 0.3,
    emissive: "#f97316",
    emissiveIntensity: 0.05,
  });

  const ringMat = new THREE.MeshBasicMaterial({
    color: "#f97316",
    transparent: true,
    opacity: 0.7,
  });

  return (
    <group ref={group} position={[0, -0.2, 0]}>
      {/* Head */}
      <mesh position={[0, 1.7, 0]} material={bodyMat}>
        <sphereGeometry args={[0.32, 32, 32]} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.35, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.1, 0.13, 0.18, 16]} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 0.65, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.45, 0.38, 1.2, 24]} />
      </mesh>
      {/* Hips */}
      <mesh position={[0, -0.05, 0]} material={bodyMat}>
        <cylinderGeometry args={[0.42, 0.38, 0.35, 24]} />
      </mesh>
      {/* Arms */}
      <mesh position={[-0.55, 0.65, 0]} rotation={[0, 0, 0.1]} material={bodyMat}>
        <capsuleGeometry args={[0.11, 1.0, 8, 16]} />
      </mesh>
      <mesh position={[0.55, 0.65, 0]} rotation={[0, 0, -0.1]} material={bodyMat}>
        <capsuleGeometry args={[0.11, 1.0, 8, 16]} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.2, -0.95, 0]} material={bodyMat}>
        <capsuleGeometry args={[0.15, 1.1, 8, 16]} />
      </mesh>
      <mesh position={[0.2, -0.95, 0]} material={bodyMat}>
        <capsuleGeometry args={[0.15, 1.1, 8, 16]} />
      </mesh>

      {/* Animated scan rings */}
      <mesh ref={ringTop} rotation={[Math.PI / 2, 0, 0]} material={ringMat}>
        <torusGeometry args={[0.55, 0.012, 8, 64]} />
      </mesh>
      <mesh ref={ringMid} rotation={[Math.PI / 2, 0, 0]} material={ringMat}>
        <torusGeometry args={[0.6, 0.012, 8, 64]} />
      </mesh>
      <mesh ref={ringLow} rotation={[Math.PI / 2, 0, 0]} material={ringMat}>
        <torusGeometry args={[0.5, 0.012, 8, 64]} />
      </mesh>

      {/* Floor pad */}
      <mesh position={[0, -1.65, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.85, 64]} />
        <meshBasicMaterial color="#f97316" transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

export default function ScannerHero3D() {
  return (
    <div className="relative w-full h-[420px] sm:h-[520px] rounded-3xl overflow-hidden bg-gradient-to-b from-[#0a0a0f] via-[#15151f] to-[#0a0a0f] border border-orange-500/20">
      <Canvas
        camera={{ position: [0, 0.5, 5.2], fov: 42 }}
        dpr={[1, 1.6]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.5} />
        <spotLight position={[5, 5, 5]} intensity={1.2} angle={0.4} penumbra={1} color="#ffffff" />
        <pointLight position={[-3, 2, -3]} intensity={0.6} color="#f97316" />
        <pointLight position={[3, -2, 3]} intensity={0.4} color="#6366f1" />
        <Suspense fallback={null}>
          <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.4}>
            <MannequinAvatar />
          </Float>
          <Environment preset="city" />
        </Suspense>
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          minPolarAngle={Math.PI / 3}
          maxPolarAngle={Math.PI / 1.7}
          autoRotate={false}
        />
      </Canvas>
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] tracking-[0.3em] uppercase text-orange-400/70">
        Drag to rotate
      </div>
    </div>
  );
}
