import { useState, useEffect, lazy, Suspense } from 'react';
import ScrollProgressBar from '@/components/ui/ScrollProgressBar';
import RegisterModal from '@/components/ui/RegisterModal';
import useSoundEffects from '@/hooks/useSoundEffects';

// Lazy-load Scene3D so the heavy Three.js / drei bundle does not block the
// main thread during initial paint. This dramatically reduces Max Potential FID.
const Scene3D = lazy(() => import('@/components/3d/Scene3D'));

const InclineAscent = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [mountScene, setMountScene] = useState(false);
  const { handleScrollProgress } = useSoundEffects({ enabled: true });

  // Defer mounting the 3D scene until after first paint so input handlers
  // are registered and the browser can respond to user input quickly.
  useEffect(() => {
    const idle = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout?: number }) => number)
      | undefined;
    if (idle) {
      const id = idle(() => setMountScene(true), { timeout: 800 });
      return () => (window as any).cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(() => setMountScene(true), 0);
    return () => window.clearTimeout(t);
  }, []);

  const onScrollProgress = (progress: number) => {
    setScrollProgress(progress);
    handleScrollProgress(progress);
  };

  return (
    <div className="w-full min-h-[100dvh] bg-background">
      <ScrollProgressBar progress={scrollProgress} />
      {mountScene && (
        <Suspense fallback={null}>
          <Scene3D onScrollProgress={onScrollProgress} />
        </Suspense>
      )}
      <RegisterModal />
    </div>
  );
};

export default InclineAscent;
