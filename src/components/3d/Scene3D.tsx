import { Canvas } from '@react-three/fiber';
import { Suspense, useState, useEffect, useRef } from 'react';
import HeroDumbbell from './HeroDumbbell';
import FloatingWords from './FloatingWords';
import ScrollOverlay from '../ui/ScrollOverlay';

interface SceneContentProps {
  isMobile: boolean;
  scrollProgress: number;
}

const SceneContent = ({ isMobile, scrollProgress }: SceneContentProps) => {
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
      <HeroDumbbell scrollProgress={scrollProgress} isMobile={isMobile} />
    </>
  );
};

interface Scene3DProps {
  onScrollProgress: (progress: number) => void;
}

const Scene3D = ({ onScrollProgress }: Scene3DProps) => {
  const [isMobile, setIsMobile] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const onScrollProgressRef = useRef(onScrollProgress);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    onScrollProgressRef.current = onScrollProgress;
  }, [onScrollProgress]);

  useEffect(() => {
    let frame = 0;
    const updateScrollProgress = () => {
      frame = 0;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      const nextProgress = maxScroll > 0 ? Math.min(Math.max(window.scrollY / maxScroll, 0), 1) : 0;
      setScrollProgress(nextProgress);
      onScrollProgressRef.current(nextProgress);
    };

    const requestUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScrollProgress);
    };

    updateScrollProgress();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, []);

  return (
    <>
      {/* DOM-rendered floating words sit between the static SEO hero and the
          WebGL canvas. They animate via CSS keyframes — no per-frame work. */}
      <FloatingWords scrollProgress={scrollProgress} />

      <div className="fixed inset-0 z-[2] pointer-events-none" style={{ height: '100dvh' }}>
        <Canvas
          camera={{ position: [0, 0, 5], fov: 50 }}
          dpr={isMobile ? [1, 1.25] : [1, 1.75]}
          gl={{ antialias: !isMobile, alpha: true, powerPreference: 'high-performance' }}
          style={{ background: 'transparent' }}
        >
          <Suspense fallback={null}>
            <SceneContent isMobile={isMobile} scrollProgress={scrollProgress} />
          </Suspense>
        </Canvas>
      </div>

      <div className="relative z-[3]">
        <ScrollOverlay />
      </div>
    </>
  );
};

export default Scene3D;
