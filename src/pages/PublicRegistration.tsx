import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { SignaturePad, type SignaturePadHandle } from "@/components/registration/SignaturePad";
import { RegistrationHero } from "@/components/registration/RegistrationHero";
import { RegistrationStepper } from "@/components/registration/RegistrationStepper";
import { StepShell } from "@/components/registration/StepShell";
import { toast } from "sonner";
import {
  Loader2, ShieldCheck, Dumbbell, ArrowRight, ArrowLeft,
  Flame, Trophy, Activity, Heart, Sparkles, RefreshCw, ChevronDown,
} from "lucide-react";

const PARQ_QUESTIONS = [
  "Has a doctor ever said you have a heart condition?",
  "Do you feel chest pain when you do physical activity?",
  "Have you had chest pain when not doing physical activity in the last month?",
  "Do you lose balance because of dizziness or lose consciousness?",
  "Do you have a bone or joint problem worsened by exercise?",
  "Are you currently on prescribed medication for blood pressure or heart?",
  "Do you know any other reason you should not do physical activity?",
];

const PRIMARY_GOALS = [
  { key: "Weight Loss", icon: Flame },
  { key: "Muscle Gain", icon: Trophy },
  { key: "Endurance", icon: Activity },
  { key: "General Fitness", icon: Heart },
] as const;
const MORE_GOALS = ["Flexibility", "Body Recomposition"] as const;

const HEALTH_CONDITION_OPTIONS = [
  "Diabetes", "Hypertension / High BP", "Heart condition", "Asthma / Respiratory",
  "Thyroid disorder", "Back / Spine pain", "Knee / Joint injury", "Shoulder injury",
  "Recent surgery", "Pregnancy", "PCOS / PCOD", "Cholesterol", "Migraine", "Other",
];

const detailsSchema = z.object({
  full_name: z.string().trim().min(2, "Full name required").max(120),
  phone: z.string().regex(/^\+91\d{10}$/, "Enter a valid +91 number"),
  email: z.string().email("Valid email required"),
  date_of_birth: z.string().min(1, "DOB required"),
  gender: z.enum(["male", "female", "other"]),
  branch_id: z.string().uuid("Select a branch"),
  city: z.string().optional(),
  state: z.string().optional(),
  postal_code: z.string().optional(),
  address: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  fitness_goals: z.string().optional(),
  health_conditions: z.string().optional(),
  health_conditions_other: z.string().optional(),
});
type DetailsForm = z.infer<typeof detailsSchema>;

export default function PublicRegistration() {
  const nav = useNavigate();
  const [step, setStep] = useState<"details" | "parq" | "sign" | "otp" | "done">("details");
  const [details, setDetails] = useState<DetailsForm | null>(null);
  const [parq, setParq] = useState<Record<string, string>>({});
  const [consents, setConsents] = useState({ dpdp: false, whatsapp: false, photo: false, waiver: false });
  const [signatureUrl, setSignatureUrl] = useState<string>("");
  const [otp, setOtp] = useState("");
  const [healthConditions, setHealthConditions] = useState<string[]>([]);
  const [healthOther, setHealthOther] = useState("");
  const [showMoreGoals, setShowMoreGoals] = useState(false);
  const sigRef = useRef<SignaturePadHandle>(null);

  const { data: branches } = useQuery({
    queryKey: ["public-branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, name, city").eq("is_active", true).order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<DetailsForm>({
    resolver: zodResolver(detailsSchema),
    defaultValues: { gender: "male" as const, phone: "+91" } as Partial<DetailsForm> as DetailsForm,
  });

  const selectedGoal = form.watch("fitness_goals");

  const sendOtp = useMutation({
    mutationFn: async (phone: string) => {
      const { data, error } = await supabase.functions.invoke("register-member", { body: { mode: "send_otp", phone } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.status === "already_member") throw new Error("This number is already registered. Please log in.");
      return data;
    },
    onSuccess: () => { toast.success("OTP sent on WhatsApp"); setStep("otp"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyAndRegister = useMutation({
    mutationFn: async () => {
      if (!details) throw new Error("Missing details");
      const { data, error } = await supabase.functions.invoke("register-member", {
        body: {
          mode: "verify_and_register",
          phone: details.phone,
          code: otp,
          registration: details,
          par_q: parq,
          consents,
          signature_data_url: signatureUrl,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { access_token: string; refresh_token: string; member_code: string };
    },
    onSuccess: async (data) => {
      if (data.access_token && data.refresh_token) {
        await supabase.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
      }
      toast.success(`Welcome to Incline! Your member code: ${data.member_code}`);
      setStep("done");
      setTimeout(() => nav("/member"), 1500);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitDetails = form.handleSubmit((values) => {
    const conditions = [...healthConditions];
    if (conditions.includes("Other") && healthOther.trim()) {
      const idx = conditions.indexOf("Other");
      conditions[idx] = `Other: ${healthOther.trim()}`;
    } else if (conditions.includes("Other") && !healthOther.trim()) {
      conditions.splice(conditions.indexOf("Other"), 1);
    }
    const merged: DetailsForm = { ...values, health_conditions: conditions.join(", ") || undefined };
    setDetails(merged);
    setStep("parq");
  });
  const submitParq = () => {
    const map: Record<string, string> = {};
    PARQ_QUESTIONS.forEach((q, i) => { map[q] = parq[`q${i}`] || "no"; });
    setParq(map);
    setStep("sign");
  };
  const submitSign = () => {
    if (sigRef.current?.isEmpty()) return toast.error("Please sign before continuing");
    if (!consents.dpdp || !consents.whatsapp || !consents.waiver) return toast.error("All required consents must be accepted");
    setSignatureUrl(sigRef.current!.toDataURL());
    sendOtp.mutate(details!.phone);
  };

  const stepIdx = useMemo(() => ({ details: 0, parq: 1, sign: 2, otp: 3, done: 4 }[step]), [step]);

  return (
    <div
      className="min-h-[100dvh] bg-slate-50"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid min-h-[100dvh] lg:grid-cols-[5fr_7fr]">
        {/* LEFT — Hero (lg+ only) */}
        <RegistrationHero />

        {/* Mobile gradient header strip */}
        <div className="relative h-[180px] overflow-hidden bg-gradient-to-br from-indigo-700 via-violet-700 to-fuchsia-700 lg:hidden">
          <div
            className="absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), transparent 50%), radial-gradient(circle at 70% 80%, rgba(236,72,153,0.4), transparent 50%)",
            }}
          />
          <div className="relative flex h-full flex-col justify-between p-5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-white/15 p-2 backdrop-blur-md ring-1 ring-white/20">
                <Dumbbell className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-base font-bold">The Incline Life</h1>
                <p className="text-[10px] text-white/70">Member registration</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">Welcome</p>
              <h2 className="mt-1 text-2xl font-bold leading-tight">Your transformation<br />starts here.</h2>
            </div>
          </div>
        </div>

        {/* RIGHT — Form panel */}
        <div className="flex items-start justify-center px-4 py-8 sm:px-8 lg:items-center lg:py-12">
          <div className="w-full max-w-xl">
            <RegistrationStepper currentIdx={Math.min(stepIdx, 3)} />

            {step === "details" && (
              <StepShell title="Tell us about yourself" subtitle="A few details to get you started.">
                <form onSubmit={submitDetails} className="space-y-5">
                  <Field label="Full name" error={form.formState.errors.full_name?.message}>
                    <Input className={inputCls} placeholder="Your name" {...form.register("full_name")} />
                  </Field>
                  <Field label="Phone (WhatsApp)" error={form.formState.errors.phone?.message}>
                    <PhoneInput value={form.watch("phone")} onChange={(v) => form.setValue("phone", v)} />
                  </Field>
                  <Field label="Email" error={form.formState.errors.email?.message}>
                    <Input type="email" className={inputCls} placeholder="you@example.com" {...form.register("email")} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Date of birth" error={form.formState.errors.date_of_birth?.message}>
                      <Input type="date" className={inputCls} {...form.register("date_of_birth")} />
                    </Field>
                    <Field label="Gender">
                      <select className={selectCls} {...form.register("gender")}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </Field>
                  </div>

                  <Field label="Choose your home branch" error={form.formState.errors.branch_id?.message}>
                    <select className={selectCls} {...form.register("branch_id")}>
                      <option value="">Select a branch…</option>
                      {branches?.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.city ? `— ${b.city}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="City"><Input className={inputCls} {...form.register("city")} /></Field>
                    <Field label="Pincode"><Input className={inputCls} {...form.register("postal_code")} /></Field>
                  </div>
                  <Field label="Emergency contact name"><Input className={inputCls} {...form.register("emergency_contact_name")} /></Field>
                  <Field label="Emergency contact phone"><Input className={inputCls} {...form.register("emergency_contact_phone")} /></Field>

                  {/* Fitness goal — segmented cards */}
                  <Field label="What's your primary fitness goal? (optional)">
                    <div className="grid grid-cols-2 gap-2.5">
                      {PRIMARY_GOALS.map((g) => {
                        const Icon = g.icon;
                        const active = selectedGoal === g.key;
                        return (
                          <button
                            type="button"
                            key={g.key}
                            onClick={() => form.setValue("fitness_goals", active ? "" : g.key)}
                            className={`flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all duration-200 ${
                              active
                                ? "border-indigo-500 bg-indigo-50 shadow-md shadow-indigo-500/10"
                                : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className={`rounded-lg p-1.5 ${active ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-600"}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <span className={`text-sm font-medium ${active ? "text-indigo-700" : "text-slate-700"}`}>
                              {g.key}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMoreGoals((v) => !v)}
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMoreGoals ? "rotate-180" : ""}`} />
                      {showMoreGoals ? "Fewer" : "More options"}
                    </button>
                    {showMoreGoals && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {MORE_GOALS.map((g) => {
                          const active = selectedGoal === g;
                          return (
                            <button
                              type="button"
                              key={g}
                              onClick={() => form.setValue("fitness_goals", active ? "" : g)}
                              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                                active ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                              }`}
                            >
                              {g}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </Field>

                  {/* Health conditions — pill chips */}
                  <Field label="Any health conditions or injuries? (tap all that apply)">
                    <div className="flex flex-wrap gap-2">
                      {HEALTH_CONDITION_OPTIONS.map((opt) => {
                        const checked = healthConditions.includes(opt);
                        return (
                          <button
                            type="button"
                            key={opt}
                            onClick={() =>
                              setHealthConditions((prev) =>
                                checked ? prev.filter((p) => p !== opt) : [...prev, opt]
                              )
                            }
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                              checked
                                ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {healthConditions.includes("Other") && (
                      <Input
                        placeholder="Please specify"
                        value={healthOther}
                        onChange={(e) => setHealthOther(e.target.value)}
                        className={`mt-3 ${inputCls}`}
                      />
                    )}
                    <p className="mt-2 text-[11px] text-slate-500">Leave blank if none. Confidential — only your trainer sees this.</p>
                  </Field>

                  <Button type="submit" className={primaryBtnCls}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </form>
              </StepShell>
            )}

            {step === "parq" && (
              <StepShell title="Quick health check" subtitle="Answer honestly. We use this to keep you safe.">
                <div className="space-y-3">
                  {PARQ_QUESTIONS.map((q, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                      <p className="mb-3 text-sm font-medium text-slate-800">{q}</p>
                      <div className="flex gap-2">
                        {(["no", "yes"] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setParq((p) => ({ ...p, [`q${i}`]: v }))}
                            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                              parq[`q${i}`] === v
                                ? v === "yes"
                                  ? "bg-amber-500 text-white shadow-md shadow-amber-500/30"
                                  : "bg-emerald-500 text-white shadow-md shadow-emerald-500/30"
                                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {v.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex gap-3">
                  <Button type="button" variant="outline" className={secondaryBtnCls} onClick={() => setStep("details")}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                  </Button>
                  <Button type="button" className={primaryBtnCls} onClick={submitParq}>
                    Continue <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </StepShell>
            )}

            {step === "sign" && (
              <StepShell title="Waiver & signature" subtitle="One last thing — review and sign to continue.">
                <div className="space-y-5">
                  <div className="max-h-44 overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-relaxed text-slate-700">
                    I acknowledge that physical exercise involves inherent risk of injury. I voluntarily assume all such risks and agree to follow gym rules, trainer instructions, and equipment guidelines. I release The Incline Life by Incline, its staff and contractors from liability for any injury, loss, or damage arising from my participation, except in cases of gross negligence. I confirm my PAR-Q answers are accurate and I'll seek medical clearance if any answer was "Yes".
                  </div>

                  <div className="space-y-2.5">
                    {[
                      { k: "waiver", l: "I accept the assumption of risk and waiver above.", required: true },
                      { k: "dpdp", l: "I consent to processing of my personal data per the DPDP Act, 2023.", required: true },
                      { k: "whatsapp", l: "I agree to receive WhatsApp / SMS updates from Incline.", required: true },
                      { k: "photo", l: "I consent to my photo being used for member identification.", required: false },
                    ].map((c) => (
                      <label key={c.k} className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                        <Checkbox
                          checked={(consents as Record<string, boolean>)[c.k]}
                          onCheckedChange={(v) => setConsents((s) => ({ ...s, [c.k]: !!v }))}
                          className="mt-0.5 data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                        />
                        <span className="leading-snug">
                          {c.l}
                          {c.required && <span className="ml-1 text-red-500">*</span>}
                          {!c.required && <span className="ml-1 text-slate-400">(optional)</span>}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div>
                    <Label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Signature
                    </Label>
                    <p className="mb-2 mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Sparkles className="h-3 w-3 text-indigo-500" />
                      Sign with Apple Pencil or your finger
                    </p>
                    <div className="overflow-hidden rounded-xl ring-1 ring-slate-300 bg-white">
                      <SignaturePad ref={sigRef} />
                    </div>
                    <button
                      type="button"
                      className="mt-2 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      onClick={() => sigRef.current?.clear()}
                    >
                      <RefreshCw className="h-3 w-3" /> Clear & redo
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" className={secondaryBtnCls} onClick={() => setStep("parq")}>
                      <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Button>
                    <Button type="button" className={primaryBtnCls} onClick={submitSign} disabled={sendOtp.isPending}>
                      {sendOtp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send OTP <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </StepShell>
            )}

            {step === "otp" && (
              <StepShell title="Verify your number" subtitle={`We sent a 6-digit code to ${details?.phone} on WhatsApp.`}>
                <div className="space-y-6">
                  <div className="flex justify-center">
                    <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                      <InputOTPGroup className="gap-2">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot
                            key={i}
                            index={i}
                            className="h-14 w-12 rounded-xl border-2 border-slate-200 bg-white text-xl font-bold text-slate-900 shadow-sm transition-all data-[active=true]:border-indigo-500 data-[active=true]:ring-2 data-[active=true]:ring-indigo-500/20"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>
                  <Button
                    type="button"
                    className={primaryBtnCls}
                    disabled={otp.length !== 6 || verifyAndRegister.isPending}
                    onClick={() => verifyAndRegister.mutate()}
                  >
                    {verifyAndRegister.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify & complete <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <button
                    type="button"
                    className="block w-full text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                    onClick={() => sendOtp.mutate(details!.phone)}
                    disabled={sendOtp.isPending}
                  >
                    Resend code
                  </button>
                </div>
              </StepShell>
            )}

            {step === "done" && (
              <StepShell title="You're in!" subtitle="Welcome to the Incline family.">
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                    <ShieldCheck className="h-8 w-8 text-emerald-600" />
                  </div>
                  <p className="text-sm text-slate-600">
                    Visit reception to activate your plan. Redirecting to your dashboard…
                  </p>
                </div>
              </StepShell>
            )}

            <p className="mt-6 text-center text-[11px] text-slate-400">
              By continuing you agree to our terms. © 2026 The Incline Life by Incline.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputCls = "h-12 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-0";
const selectCls = "h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none";
const primaryBtnCls = "h-12 flex-1 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 hover:opacity-95 hover:shadow-xl hover:shadow-indigo-500/40 transition-all";
const secondaryBtnCls = "h-12 flex-1 rounded-xl border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold uppercase tracking-wider text-slate-600">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-500">{error}</p>}
    </div>
  );
}
