import { useMemo } from "react";

interface FloatingWordsProps {
  scrollProgress: number;
}

const WORDS = ["RISE", "REFLECT", "REPEAT", "RECOVER", "RESTORE", "REBUILD"];

// Each word gets independent placement, size, opacity, and a random
// direction animation defined in src/index.css. Pure DOM/CSS — safe to
// render outside the R3F <Canvas>.
const FLOATERS = [
  { word: "RISE",    top: "12%", left: "8%",  size: "clamp(0.75rem, 1.8vw, 1.25rem)", anim: "incFloatA", dur: 12, delay: 0 },
  { word: "REFLECT", top: "22%", left: "72%", size: "clamp(0.7rem, 1.6vw, 1.1rem)",   anim: "incFloatB", dur: 14, delay: 1.2 },
  { word: "REPEAT",  top: "55%", left: "5%",  size: "clamp(0.8rem, 2vw, 1.4rem)",     anim: "incFloatC", dur: 16, delay: 2.4 },
  { word: "RECOVER", top: "70%", left: "60%", size: "clamp(0.7rem, 1.6vw, 1.1rem)",   anim: "incFloatD", dur: 13, delay: 0.6 },
  { word: "RESTORE", top: "38%", left: "40%", size: "clamp(0.65rem, 1.4vw, 1rem)",    anim: "incFloatE", dur: 15, delay: 1.8 },
  { word: "REBUILD", top: "85%", left: "30%", size: "clamp(0.75rem, 1.8vw, 1.25rem)", anim: "incFloatF", dur: 17, delay: 3 },
] as const;

const FloatingWords = ({ scrollProgress }: FloatingWordsProps) => {
  // Frosted-soft ambient opacity, modulated subtly by scroll.
  const baseOpacity = useMemo(() => {
    if (scrollProgress < 0.1) return 0.18;
    if (scrollProgress > 0.9) return 0.08;
    return 0.14;
  }, [scrollProgress]);

  // Skip when length matches WORDS — defensive, in case lists drift.
  const items = FLOATERS.length === WORDS.length ? FLOATERS : FLOATERS;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      style={{ height: "100dvh" }}
    >
      {items.map((f, i) => (
        <span
          key={i}
          className="absolute font-oswald font-bold whitespace-nowrap select-none tracking-[0.18em]"
          style={{
            top: f.top,
            left: f.left,
            fontSize: f.size,
            color: "hsl(217 91% 50%)",
            opacity: baseOpacity,
            animation: `${f.anim} ${f.dur}s ease-in-out ${f.delay}s infinite`,
            willChange: "transform, opacity",
            textShadow: "0 0 24px hsl(217 91% 50% / 0.25)",
          }}
        >
          {f.word}
        </span>
      ))}
    </div>
  );
};

export default FloatingWords;
