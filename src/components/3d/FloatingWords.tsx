/**
 * FloatingWords — DOM overlay rendered behind the dumbbell. Words drift
 * slowly across the viewport (left → right) using a single GPU-only CSS
 * keyframe. Subtle by design: low opacity, ambient sizing.
 */

interface FloatingWordsProps {
  scrollProgress: number;
}

interface WordPlacement {
  word: string;
  /** Vertical anchor as % of viewport height. */
  top: string;
  /** Font size — clamp keeps it ambient on every screen. */
  size: string;
  /** Animation delay so each word is at a different point in its drift. */
  delay: string;
  /** Drift duration — long values feel ambient. */
  duration: string;
}

const placements: WordPlacement[] = [
  { word: 'REBUILD', top: '14%', size: 'clamp(1.25rem, 3.2vw, 2.75rem)', delay: '0s',   duration: '24s' },
  { word: 'RESTORE', top: '26%', size: 'clamp(1rem, 2.6vw, 2.25rem)',    delay: '-6s',  duration: '28s' },
  { word: 'RECOVER', top: '42%', size: 'clamp(1rem, 2.4vw, 2rem)',       delay: '-12s', duration: '26s' },
  { word: 'REPEAT',  top: '56%', size: 'clamp(1.25rem, 3vw, 2.5rem)',    delay: '-3s',  duration: '30s' },
  { word: 'REFLECT', top: '68%', size: 'clamp(1.25rem, 3.2vw, 2.75rem)', delay: '-18s', duration: '32s' },
  { word: 'RISE',    top: '78%', size: 'clamp(1rem, 2.6vw, 2.25rem)',    delay: '-9s',  duration: '22s' },
];

const FloatingWords = ({ scrollProgress }: FloatingWordsProps) => {
  // Subtle, ambient — must never compete with the hero copy.
  let baseOpacity = 0.14;
  if (scrollProgress > 0.2 && scrollProgress < 0.5) baseOpacity = 0.2;
  else if (scrollProgress > 0.9) baseOpacity = 0.08;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[1] pointer-events-none overflow-hidden select-none"
      style={{ height: '100dvh' }}
    >
      {placements.map((p, i) => (
        <span
          key={p.word + i}
          className="absolute font-oswald font-semibold uppercase tracking-wider text-primary whitespace-nowrap"
          style={{
            top: p.top,
            left: 0,
            fontSize: p.size,
            opacity: baseOpacity,
            transform: 'translate3d(0,0,0)',
            willChange: 'transform, opacity',
            animation: `inclineDrift ${p.duration} linear ${p.delay} infinite`,
            letterSpacing: '0.08em',
          }}
        >
          {p.word}
        </span>
      ))}
    </div>
  );
};

export default FloatingWords;
