import { Canvas } from '@react-three/fiber';
import { Environment, ScrollControls, useScroll, Scroll } from '@react-three/drei';
import { Suspense, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import HeroDumbbell from './HeroDumbbell';
import FloatingWords from './FloatingWords';
import ScrollOverlay from '../ui/ScrollOverlay';

interface SceneContentProps {
  isMobile: boolean;
  onScrollProgress: (progress: number) => void;
}

const SceneContent = ({ isMobile, onScrollProgress }: SceneContentProps) => {
  const scroll = useScroll();
  const [scrollProgress, setScrollProgress] = useState(0);

  useFrame(() => {
    const offset = scroll.offset;
    setScrollProgress(offset);
    onScrollProgress(offset);
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={1.5} castShadow color="#ffffff" />
      <spotLight position={[-10, 5, -5]} angle={0.4} penumbra={1} intensity={0.8} color="#3b82f6" />
      <pointLight position={[0, 5, 5]} intensity={0.8} color="#ffffff" />
      <pointLight position={[0, -5, 0]} intensity={0.3} color="#3b82f6" />
      <Environment preset="city" />
      <HeroDumbbell scrollProgress={scrollProgress} isMobile={isMobile} />
      <FloatingWords scrollProgress={scrollProgress} />
      <Scroll html style={{ width: '100%' }}>
        <ScrollOverlay />
      </Scroll>
    </>
  );
};

interface Scene3DProps {
  onScrollProgress: (progress: number) => void;
}

const Scene3D = ({ onScrollProgress }: Scene3DProps) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="fixed inset-0 z-0" style={{ height: '100dvh' }}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 50 }}
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)' }}
      >
        <Suspense fallback={null}>
          <ScrollControls pages={5} damping={0.2}>
            <SceneContent isMobile={isMobile} onScrollProgress={onScrollProgress} />
          </ScrollControls>
        </Suspense>
      </Canvas>
    </div>
  );
};

export default Scene3D;
