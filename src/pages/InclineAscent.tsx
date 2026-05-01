import { useState, useEffect, lazy, Suspense } from 'react';
import ScrollProgressBar from '@/components/ui/ScrollProgressBar';
import RegisterModal from '@/components/ui/RegisterModal';
import LegalModal from '@/components/ui/LegalModal';
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

      {/*
        Static SEO hero — paints instantly for LCP / crawlers.
        The 3D Canvas mounts on top (z-0 + fixed) and visually covers this
        layer once ready, so users see no change. The H1 text matches the
        Scroll overlay exactly to avoid any visual mismatch during handoff.
      */}
      <section
        aria-hidden={mountScene}
        className="fixed inset-0 -z-10 flex items-center px-4 pointer-events-none"
        style={{ height: '100dvh' }}
      >
        <div className="w-full max-w-7xl mx-auto flex justify-end">
          <div className="max-w-md text-right mr-8 md:mr-32">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-foreground leading-tight mb-6 tracking-tight">
              WHERE <span className="text-primary">GLOBAL STRENGTH</span>
              <br />
              MEETS <span className="text-primary">CLINICAL SERENITY.</span>
            </h1>
            <p className="text-muted-foreground text-base leading-relaxed">
              Rajasthan's new benchmark for excellence. An elevated sanctuary designed for the driven—delivering Italian
              biomechanics in every rep, and advanced restoration in every recovery.
            </p>
          </div>
        </div>
      </section>

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
