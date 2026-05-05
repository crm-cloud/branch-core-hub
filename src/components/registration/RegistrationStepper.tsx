import { Check } from "lucide-react";

const STEPS = [
  { key: "details", label: "Details" },
  { key: "parq", label: "Health" },
  { key: "sign", label: "Waiver" },
  { key: "otp", label: "Verify" },
];

export function RegistrationStepper({ currentIdx }: { currentIdx: number }) {
  const pct = Math.min(100, (currentIdx / (STEPS.length - 1)) * 100);
  return (
    <div className="mb-6">
      <div className="relative mb-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        {STEPS.map((s, i) => {
          const done = i < currentIdx;
          const active = i === currentIdx;
          return (
            <div key={s.key} className="flex flex-col items-center gap-1.5">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
                  done
                    ? "bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30"
                    : active
                    ? "bg-white text-indigo-600 ring-2 ring-indigo-500 shadow-lg shadow-indigo-500/20 animate-pulse"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-[10px] font-semibold uppercase tracking-wide ${
                  active ? "text-indigo-600" : done ? "text-slate-700" : "text-slate-400"
                }`}
              >
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
