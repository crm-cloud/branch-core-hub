import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Text } from "@react-three/drei";
import * as THREE from "three";

interface FloatingWordsProps {
  scrollProgress: number;
}

const words = ["RISE", "REFLECT", "REPEAT", "RECOVER", "RESTORE", "REBUILD"];

const FloatingWords = ({ scrollProgress }: FloatingWordsProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const wordRefs = useRef<THREE.Mesh[]>([]);

  // Create word instances with different orbital parameters
  const wordInstances = useMemo(() => {
    return words.map((word, i) => ({
      word,
      radius: 2.2 + (i % 3) * 0.6,
      speed: 0.08 + i * 0.03,
      yOffset: (i - 2.5) * 0.5,
      phase: (i / words.length) * Math.PI * 2,
      floatSpeed: 0.3 + i * 0.1,
      floatAmplitude: 0.15 + (i % 2) * 0.1,
    }));
  }, []);

  useFrame((state) => {
    const time = state.clock.elapsedTime;

    wordRefs.current.forEach((mesh, i) => {
      if (!mesh) return;

      const instance = wordInstances[i];

      // Orbital motion around the dumbbell
      const angle = instance.phase + time * instance.speed;
      const x = Math.cos(angle) * instance.radius;
      const z = Math.sin(angle) * instance.radius * 0.5; // Elliptical orbit

      // Vertical floating motion
      const y = instance.yOffset + Math.sin(time * instance.floatSpeed + instance.phase) * instance.floatAmplitude;

      mesh.position.set(x, y, z);

      // Make text face the camera (billboard effect)
      mesh.lookAt(state.camera.position);
    });

    // Rotate entire group slowly
    if (groupRef.current) {
      groupRef.current.rotation.y = time * 0.02;
    }
  });

  // Calculate opacity based on scroll - frosted glass effect (visible but soft)
  const opacity = useMemo(() => {
    if (scrollProgress < 0.1) return 0.4;
    if (scrollProgress > 0.2 && scrollProgress < 0.5) return 0.55;
    if (scrollProgress > 0.9) return 0.25;
    return 0.4;
  }, [scrollProgress]);

  return (
    <group ref={groupRef}>
      {wordInstances.map((instance, i) => (
        <Text
          key={i}
          ref={(el) => {
            if (el) wordRefs.current[i] = el;
          }}
          fontSize={0.12 + (i % 3) * 0.03}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          fillOpacity={opacity}
          outlineWidth={0.003}
          outlineColor="#3b82f6"
          outlineOpacity={opacity * 0.5}
          letterSpacing={0.08}
        >
          {instance.word}
        </Text>
      ))}
    </group>
  );
};

export default FloatingWords;
