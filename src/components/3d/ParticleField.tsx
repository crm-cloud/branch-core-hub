import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ParticleFieldProps {
  scrollProgress: number;
  count?: number;
}

const ParticleField = ({ scrollProgress, count = 200 }: ParticleFieldProps) => {
  const meshRef = useRef<THREE.Points>(null);

  const { positions, velocities, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const r = 2 + Math.random() * 4;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
      sizes[i] = Math.random() * 0.05 + 0.02;
    }
    return { positions, velocities, sizes };
  }, [count]);

  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geometry;
  }, [positions, sizes]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    const positionAttribute = meshRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      positionAttribute.array[idx] += velocities[idx] + Math.sin(time + i) * 0.001;
      positionAttribute.array[idx + 1] += velocities[idx + 1] + Math.cos(time + i) * 0.001;
      positionAttribute.array[idx + 2] += velocities[idx + 2];
      for (let j = 0; j < 3; j++) {
        if (Math.abs(positionAttribute.array[idx + j]) > 6) {
          positionAttribute.array[idx + j] *= -0.5;
        }
      }
    }
    positionAttribute.needsUpdate = true;
    meshRef.current.rotation.y = time * 0.05;
    meshRef.current.rotation.x = Math.sin(time * 0.1) * 0.1;
  });

  const opacity = useMemo(() => {
    if (scrollProgress < 0.1) return 0.3;
    if (scrollProgress > 0.2 && scrollProgress < 0.5) return 0.8;
    if (scrollProgress > 0.9) return 0.2;
    return 0.5;
  }, [scrollProgress]);

  return (
    <points ref={meshRef} geometry={particleGeometry}>
      <pointsMaterial size={0.04} color="#2563eb" transparent opacity={opacity * 0.8} sizeAttenuation depthWrite={false} />
    </points>
  );
};

export default ParticleField;
