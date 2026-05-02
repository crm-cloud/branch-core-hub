import { Canvas } from '@react-three/fiber';
import { ScrollControls, useScroll, Scroll } from '@react-three/drei';
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

  useFrame(() => {
    onScrollProgress(scroll.offset);
  });

  return (
    <>
      {/* Cheap lighting rig — no HDR Environment so we don't ship a multi-MB
          asset on first paint of the public landing. */}
      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 10]} intensity={1.2} color="#ffffff" castShadow />
      <spotLight position={[10, 10, 10]} angle={0.3} penumbra={1} intensity={1.2} castShadow color="#ffffff" />
      <spotLight position={[-10, 5, -5]} angle={0.4} penumbra={1} intensity={0.6} color="#3b82f6" />
      <pointLight position={[0, 5, 5]} intensity={0.6} color="#ffffff" />
      <pointLight position={[0, -5, 0]} intensity={0.25} color="#3b82f6" />
      <HeroDumbbell scrollProgress={scroll.offset} isMobile={isMobile} />
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
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleScrollProgress = (p: number) => {
    setScrollProgress(p);
    onScrollProgress(p);
  };

  return (
    <>
      {/* DOM-rendered floating words sit between the static SEO hero and the
          WebGL canvas. They animate via CSS keyframes — no per-frame work. */}
      <FloatingWords scrollProgress={scrollProgress} />

      <div className="fixed inset-0 z-[2]" style={{ height: '100dvh' }}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          dpr={isMobile ? [1, 1.25] : [1, 1.75]}
          gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <ScrollControls pages={5} damping={0.2}>
              <SceneContent isMobile={isMobile} onScrollProgress={handleScrollProgress} />
            </ScrollControls>
          </Suspense>
        </Canvas>
      </div>
    </>
  );
};

export default Scene3D;
