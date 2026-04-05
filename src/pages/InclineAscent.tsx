import { useState } from 'react';
import Scene3D from '@/components/3d/Scene3D';
import ScrollProgressBar from '@/components/ui/ScrollProgressBar';
import RegisterModal from '@/components/ui/RegisterModal';
import useSoundEffects from '@/hooks/useSoundEffects';

const InclineAscent = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const { handleScrollProgress } = useSoundEffects({ enabled: true });

  const onScrollProgress = (progress: number) => {
    setScrollProgress(progress);
    handleScrollProgress(progress);
  };

  return (
    <div className="w-full min-h-[100dvh] bg-background">
      <ScrollProgressBar progress={scrollProgress} />
      <Scene3D onScrollProgress={onScrollProgress} />
      <RegisterModal />
    </div>
  );
};

export default InclineAscent;
