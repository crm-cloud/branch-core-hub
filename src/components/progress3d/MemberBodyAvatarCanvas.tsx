import { Suspense, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment, OrbitControls } from '@react-three/drei';
import { useIsMobile } from '@/hooks/use-mobile';
import { measurementToAvatarSnapshot } from '@/lib/measurements/measurementToAvatar';
import type { MemberMeasurementRecord } from '@/lib/measurements/types';
import { BodyModel } from './BodyModel';
import { BodyFallbackCard } from './BodyFallbackCard';

interface MemberBodyAvatarCanvasProps {
  measurement?: MemberMeasurementRecord | null;
  previousMeasurement?: MemberMeasurementRecord | null;
  label: string;
  /** Member profile gender — fallback when a measurement has no presentation. */
  memberGender?: string | null;
}

export function MemberBodyAvatarCanvas({ measurement, previousMeasurement, label, memberGender }: MemberBodyAvatarCanvasProps) {
  const isMobile = useIsMobile();
  const [dragRotation, setDragRotation] = useState(0);
  const [hasCanvasError, setHasCanvasError] = useState(false);
  const snapshot = useMemo(
    () => measurementToAvatarSnapshot(measurement, memberGender),
    [measurement, memberGender],
  );

  if (!measurement || hasCanvasError) {
    return <BodyFallbackCard latest={measurement} previous={previousMeasurement} title={label} />;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/95 via-primary to-primary/80 shadow-xl shadow-primary/20">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 text-primary-foreground">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-primary-foreground/70">3D body view</p>
          <h3 className="text-lg font-semibold">{label}</h3>
        </div>
        <div className="rounded-full bg-primary-foreground/10 px-3 py-1 text-xs text-primary-foreground/85">
          Drag to rotate
        </div>
      </div>
      <div className="h-[360px] w-full sm:h-[420px]">
        <Canvas
          dpr={isMobile ? [1, 1.25] : [1, 1.5]}
          camera={{ position: [0, 1.5, 4.2], fov: isMobile ? 34 : 30 }}
          gl={{ antialias: !isMobile, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => gl.setClearColor('transparent')}
          onError={() => setHasCanvasError(true)}
        >
          <ambientLight intensity={1.4} />
          <directionalLight position={[4, 5, 5]} intensity={2.2} />
          <directionalLight position={[-4, 2, 1]} intensity={0.75} />
          <Suspense fallback={null}>
            <BodyModel snapshot={snapshot} interactiveRotationY={dragRotation} />
            <Environment preset="studio" />
          </Suspense>
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 2.6}
            maxPolarAngle={Math.PI / 1.85}
            minAzimuthAngle={-Math.PI / 4}
            maxAzimuthAngle={Math.PI / 4}
            onChange={(event) => setDragRotation(event.target.getAzimuthalAngle())}
          />
        </Canvas>
      </div>
    </div>
  );
}
