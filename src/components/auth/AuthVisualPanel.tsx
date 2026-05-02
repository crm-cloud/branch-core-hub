import { useState } from "react";
import { Dumbbell, Sparkles, Zap } from "lucide-react";
import inclineLogo from "@/assets/incline-logo.png";

/**
 * Decorative left-side panel for the redesigned /auth page.
 * Pure DOM/CSS — NO react-three-fiber, NO framer-motion.
 * All motion uses CSS keyframes defined in src/index.css and respects
 * `prefers-reduced-motion`.
 */
export function AuthVisualPanel() {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <aside
      aria-hidden="true"
      className="auth-visual absolute inset-0 overflow-hidden text-white"
    >
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(at 20% 20%, hsl(217 91% 32%) 0%, transparent 55%), radial-gradient(at 80% 70%, hsl(199 95% 38%) 0%, transparent 50%), linear-gradient(135deg, hsl(222 47% 8%) 0%, hsl(217 91% 14%) 55%, hsl(199 95% 22%) 100%)",
        }}
      />

      {/* Drifting glow orbs */}
      <span className="auth-orb auth-orb-1" />
      <span className="auth-orb auth-orb-2" />
      <span className="auth-orb auth-orb-3" />

      {/* Subtle grid */}
      <div className="auth-grid absolute inset-0 opacity-[0.18]" />

      {/* Floating tagline words — kept in right margin away from main content */}
      <span
        className="absolute font-oswald font-bold tracking-widest text-white/55 select-none pointer-events-none"
        style={{
          top: "12%",
          right: "8%",
          fontSize: "clamp(0.7rem, 1.1vw, 0.9rem)",
          animation: "incFloatA 14s ease-in-out infinite",
        }}
      >
        RISE
      </span>
      <span
        className="hidden lg:block absolute font-oswald font-bold tracking-widest text-cyan-200/60 select-none pointer-events-none"
        style={{
          top: "40%",
          right: "6%",
          fontSize: "clamp(0.7rem, 1.1vw, 0.9rem)",
          animation: "incFloatB 16s ease-in-out 1s infinite",
        }}
      >
        REFLECT
      </span>
      <span
        className="hidden lg:block absolute font-oswald font-bold tracking-widest text-white/50 select-none pointer-events-none"
        style={{
          top: "70%",
          right: "14%",
          fontSize: "clamp(0.7rem, 1.1vw, 0.9rem)",
          animation: "incFloatC 18s ease-in-out 2s infinite",
        }}
      >
        REPEAT
      </span>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between p-6 sm:p-10 lg:p-14 xl:p-16">
        {/* Logo lockup — uses Incline logo image; falls back to text on error */}
        <div className="flex items-center gap-3">
          {!logoFailed ? (
            <img
              src={inclineLogo}
              alt="Incline"
              onError={() => setLogoFailed(true)}
              className="h-9 lg:h-12 w-auto object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
            />
          ) : (
            <div className="leading-tight">
              <div className="text-white font-extrabold text-xl lg:text-2xl tracking-tight">Incline</div>
              <div className="text-white/60 text-[11px] tracking-wider uppercase">The Incline Life</div>
            </div>
          )}
        </div>

        {/* Tagline + value props */}
        <div className="space-y-6 lg:space-y-8 max-w-md">
          <div className="space-y-3 lg:space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs text-white/85">
              <Sparkles className="h-3.5 w-3.5 text-cyan-200" />
              Built for serious gyms
            </div>
            <h2 className="font-oswald font-bold text-2xl sm:text-3xl lg:text-5xl xl:text-6xl leading-[1.05] tracking-tight">
              Climb higher.
              <br />
              <span className="bg-gradient-to-r from-cyan-200 via-white to-cyan-100 bg-clip-text text-transparent">
                Every. Single. Day.
              </span>
            </h2>
            <p className="hidden lg:block text-white/70 text-base leading-relaxed">
              One platform for memberships, billing, classes, recovery, biometrics and growth — across every Incline branch.
            </p>
          </div>

          <ul className="hidden lg:block space-y-3 text-sm text-white/80">
            <li className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-lg bg-white/10 border border-white/15 grid place-items-center">
                <Zap className="h-4 w-4 text-cyan-200" />
              </span>
              Lightning-fast check-ins & POS
            </li>
            <li className="flex items-center gap-3">
              <span className="h-8 w-8 rounded-lg bg-white/10 border border-white/15 grid place-items-center">
                <Dumbbell className="h-4 w-4 text-cyan-200" />
              </span>
              Smarter training, recovery & progress tracking
            </li>
          </ul>
        </div>

        {/* Footer (desktop only) */}
        <div className="hidden lg:flex items-center justify-end text-xs text-white/55">
          <span>© Incline · The Incline Life by Incline</span>
        </div>
      </div>
    </aside>
  );
}

export default AuthVisualPanel;
