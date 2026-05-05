import { useEffect, useState } from "react";
import { Dumbbell, Users, MapPin, ShieldCheck } from "lucide-react";
import { InteractiveRobotSpline } from "@/components/ui/interactive-3d-robot";

const QUOTES = [
  { q: "Lost 18kg in 6 months. The trainers are world-class.", a: "Rohan, Member since 2024" },
  { q: "First gym that actually feels like a community.", a: "Priya, Member since 2023" },
  { q: "Recovery facilities are a game-changer.", a: "Aditya, Member since 2025" },
];

const SPLINE_SCENE = "https://prod.spline.design/PyzDhpQ9E5f1E3MT/scene.splinecode";

export function RegistrationHero() {
  const [idx, setIdx] = useState(0);
  const [splineFailed, setSplineFailed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % QUOTES.length), 5000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative hidden h-[100dvh] overflow-hidden lg:block">
      {/* Gradient base */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700" />
      {/* Mesh overlay */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.25), transparent 40%), radial-gradient(circle at 80% 70%, rgba(236,72,153,0.35), transparent 45%)",
        }}
      />
      {/* 3D Robot */}
      <div className="absolute inset-0">
        {!splineFailed ? (
          <div className="h-full w-full" onError={() => setSplineFailed(true)}>
            <InteractiveRobotSpline scene={SPLINE_SCENE} className="h-full w-full" />
          </div>
        ) : null}
      </div>

      {/* Foreground content */}
      <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-md ring-1 ring-white/20">
            <Dumbbell className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">The Incline Life</h1>
            <p className="text-xs text-white/70">by Incline</p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70">Welcome to</p>
            <h2 className="mt-2 text-4xl font-bold leading-tight xl:text-5xl">
              Your transformation<br />starts here.
            </h2>
            <p className="mt-3 max-w-md text-sm text-white/80">
              Join a community of over 5,000 members training across 3 premium locations.
            </p>
          </div>

          {/* Testimonial */}
          <div className="relative h-24 max-w-md">
            {QUOTES.map((q, i) => (
              <div
                key={i}
                className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0"}`}
              >
                <p className="text-base font-medium italic text-white">"{q.q}"</p>
                <p className="mt-2 text-xs text-white/70">— {q.a}</p>
              </div>
            ))}
          </div>

          {/* Trust strip */}
          <div className="flex flex-wrap gap-3">
            <Badge icon={<Users className="h-3.5 w-3.5" />} label="5,000+ members" />
            <Badge icon={<MapPin className="h-3.5 w-3.5" />} label="3 branches" />
            <Badge icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Bank-grade security" />
          </div>
        </div>

        <p className="text-xs text-white/60">© 2026 The Incline Life by Incline</p>
      </div>
    </div>
  );
}

function Badge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md ring-1 ring-white/20">
      {icon}
      {label}
    </div>
  );
}
