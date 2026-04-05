import { useRef, useCallback } from 'react';

interface UseSoundEffectsOptions {
  enabled?: boolean;
}

export const useSoundEffects = ({ enabled = true }: UseSoundEffectsOptions = {}) => {
  const previousProgress = useRef(0);
  const hasPlayedLanding = useRef(false);

  const playWhoosh = useCallback(() => {
    if (!enabled) return;
  }, [enabled]);

  const playImpact = useCallback(() => {
    if (!enabled) return;
  }, [enabled]);

  const handleScrollProgress = useCallback((progress: number) => {
    if (!enabled) return;
    const delta = Math.abs(progress - previousProgress.current);
    if (delta > 0.02) playWhoosh();
    if (progress > 0.9 && !hasPlayedLanding.current) {
      playImpact();
      hasPlayedLanding.current = true;
    }
    if (progress < 0.85) hasPlayedLanding.current = false;
    previousProgress.current = progress;
  }, [enabled, playWhoosh, playImpact]);

  return { handleScrollProgress, playWhoosh, playImpact };
};

export default useSoundEffects;
