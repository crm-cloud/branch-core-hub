/**
 * FloatingWords — DOM overlay version (was previously rendered inside the
 * WebGL canvas via troika-three-text). Moving these words to the HTML layer
 * removes the GPOS/GSUB warnings, eliminates an in-canvas font fetch, and
 * cuts ~100KB from the three.js bundle. Visually they continue to float and
 * fade based on scrollProgress, behind the dumbbell.
 */

interface FloatingWordsProps {
  scrollProgress: number;
}

interface WordPlacement {
  word: string;
  /** Approximate position as % of viewport (top, left). */
  top: string;
  left: string;
  /** Font size in viewport widths. */
  size: string;
  /** Animation delay so each word floats out of phase. */
  delay: string;
  /** Duration variation. */
  duration: string;
}

const placements: WordPlacement[] = [
  { word: 'REBUILD',  top: '18%', left: '72%', size: 'clamp(2.5rem, 7vw, 6rem)', delay: '0s',   duration: '11s' },
  { word: 'RESTORE',  top: '28%', left: '54%', size: 'clamp(2rem, 5.5vw, 4.5rem)', delay: '1.4s', duration: '9s'  },
  { word: 'RECOVER',  top: '46%', left: '8%',  size: 'clamp(2rem, 5vw, 4rem)',     delay: '2.1s', duration: '12s' },
  { word: 'REPEAT',   top: '58%', left: '2%',  size: 'clamp(2.5rem, 6.5vw, 5.5rem)', delay: '0.8s', duration: '10s' },
  { word: 'REFLECT',  top: '70%', left: '40%', size: 'clamp(2.5rem, 7vw, 6rem)',   delay: '1.8s', duration: '13s' },
  { word: 'RISE',     top: '78%', left: '70%', size: 'clamp(2rem, 5vw, 4.5rem)',   delay: '0.4s', duration: '10s' },
];

const FloatingWords = ({ scrollProgress }: FloatingWordsProps) => {
  // Same opacity curve as the previous WebGL implementation.
  let baseOpacity = 0.32;
  if (scrollProgress > 0.2 && scrollProgress < 0.5) baseOpacity = 0.45;
  else if (scrollProgress > 0.9) baseOpacity = 0.18;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[1] pointer-events-none overflow-hidden select-none"
      style={{ height: '100dvh' }}
    >
      {placements.map((p, i) => (
        <span
          key={p.word + i}
          className="absolute font-oswald font-semibold uppercase tracking-wider text-primary"
          style={{
            top: p.top,
            left: p.left,
            fontSize: p.size,
            opacity: baseOpacity,
            transform: 'translate3d(0,0,0)',
            willChange: 'transform, opacity',
            animation: `inclineFloat ${p.duration} ease-in-out ${p.delay} infinite alternate`,
            letterSpacing: '0.06em',
          }}
        >
          {p.word}
        </span>
      ))}
    </div>
  );
};

export default FloatingWords;
