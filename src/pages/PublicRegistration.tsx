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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { PhoneInput } from "@/components/ui/PhoneInput";
import { SignaturePad, type SignaturePadHandle } from "@/components/registration/SignaturePad";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Dumbbell } from "lucide-react";

const PARQ_QUESTIONS = [
  "Has a doctor ever said you have a heart condition?",
  "Do you feel chest pain when you do physical activity?",
  "Have you had chest pain when not doing physical activity in the last month?",
  "Do you lose balance because of dizziness or lose consciousness?",
  "Do you have a bone or joint problem worsened by exercise?",
  "Are you currently on prescribed medication for blood pressure or heart?",
  "Do you know any other reason you should not do physical activity?",
];

const FITNESS_GOAL_OPTIONS = [
  "Weight Loss",
  "Muscle Gain",
  "Endurance",
  "General Fitness",
  "Flexibility",
  "Body Recomposition",
] as const;

const HEALTH_CONDITION_OPTIONS = [
  "Diabetes",
  "Hypertension / High BP",
  "Heart condition",
  "Asthma / Respiratory",
  "Thyroid disorder",
  "Back / Spine pain",
  "Knee / Joint injury",
  "Shoulder injury",
  "Recent surgery",
  "Pregnancy",
  "PCOS / PCOD",
  "Cholesterol",
  "Migraine",
  "Other",
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

  const submitDetails = form.handleSubmit((values) => { setDetails(values); setStep("parq"); });
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
    <div className="min-h-[100dvh] bg-slate-950 text-slate-100" style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 p-2.5"><Dumbbell className="h-6 w-6 text-white" /></div>
          <div>
            <h1 className="text-xl font-bold">The Incline Life</h1>
            <p className="text-xs text-slate-400">Member self-registration</p>
          </div>
        </div>

        <div className="mb-6 flex gap-2">
          {[0,1,2,3].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= stepIdx ? "bg-gradient-to-r from-indigo-500 to-violet-500" : "bg-white/10"}`} />
          ))}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
          {step === "details" && (
            <form onSubmit={submitDetails} className="space-y-4">
              <h2 className="text-lg font-semibold">Your details</h2>
              <Field label="Full name" error={form.formState.errors.full_name?.message}>
                <Input className="bg-white/5 border-white/10 text-slate-100" {...form.register("full_name")} />
              </Field>
              <Field label="Phone" error={form.formState.errors.phone?.message}>
                <PhoneInput value={form.watch("phone")} onChange={(v) => form.setValue("phone", v)} />
              </Field>
              <Field label="Email" error={form.formState.errors.email?.message}>
                <Input type="email" className="bg-white/5 border-white/10 text-slate-100" {...form.register("email")} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of birth" error={form.formState.errors.date_of_birth?.message}>
                  <Input type="date" className="bg-white/5 border-white/10 text-slate-100" {...form.register("date_of_birth")} />
                </Field>
                <Field label="Gender">
                  <select className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-slate-100" {...form.register("gender")}>
                    <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                  </select>
                </Field>
              </div>
              <Field label="Branch" error={form.formState.errors.branch_id?.message}>
                <select className="h-10 w-full rounded-md border border-white/10 bg-white/5 px-3 text-sm text-slate-100" {...form.register("branch_id")}>
                  <option value="">Select a branch…</option>
                  {branches?.map(b => <option key={b.id} value={b.id}>{b.name} {b.city ? `— ${b.city}` : ""}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="City"><Input className="bg-white/5 border-white/10 text-slate-100" {...form.register("city")} /></Field>
                <Field label="Pincode"><Input className="bg-white/5 border-white/10 text-slate-100" {...form.register("postal_code")} /></Field>
              </div>
              <Field label="Emergency contact name"><Input className="bg-white/5 border-white/10 text-slate-100" {...form.register("emergency_contact_name")} /></Field>
              <Field label="Emergency contact phone"><Input className="bg-white/5 border-white/10 text-slate-100" {...form.register("emergency_contact_phone")} /></Field>
              <Field label="Fitness goals (optional)"><Textarea rows={2} className="bg-white/5 border-white/10 text-slate-100" {...form.register("fitness_goals")} /></Field>
              <Field label="Health conditions / injuries (optional)"><Textarea rows={2} className="bg-white/5 border-white/10 text-slate-100" {...form.register("health_conditions")} /></Field>
              <Button type="submit" className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:opacity-90">Continue</Button>
            </form>
          )}

          {step === "parq" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Health declaration (PAR-Q)</h2>
              <p className="text-xs text-slate-400">Answer honestly. If unsure, choose "Yes" and we'll discuss with you.</p>
              {PARQ_QUESTIONS.map((q, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="mb-2 text-sm">{q}</p>
                  <div className="flex gap-2">
                    {(["no", "yes"] as const).map(v => (
                      <button key={v} type="button" onClick={() => setParq(p => ({ ...p, [`q${i}`]: v }))}
                        className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${parq[`q${i}`] === v ? "bg-indigo-500 text-white" : "bg-white/5 text-slate-300 hover:bg-white/10"}`}>
                        {v.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 border-white/10 bg-transparent text-slate-100 hover:bg-white/5" onClick={() => setStep("details")}>Back</Button>
                <Button type="button" className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600" onClick={submitParq}>Continue</Button>
              </div>
            </div>
          )}

          {step === "sign" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Waiver & signature</h2>
              <div className="max-h-40 overflow-auto rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-slate-300 leading-relaxed">
                I acknowledge that physical exercise involves inherent risk of injury. I voluntarily assume all such risks and agree to follow gym rules, trainer instructions, and equipment guidelines. I release The Incline Life by Incline, its staff and contractors from liability for any injury, loss, or damage arising from my participation, except in cases of gross negligence. I confirm my PAR-Q answers are accurate and I'll seek medical clearance if any answer was "Yes".
              </div>

              <div className="space-y-2">
                {[
                  { k: "waiver", l: "I accept the assumption of risk and waiver above." },
                  { k: "dpdp", l: "I consent to processing of my personal data per the DPDP Act, 2023." },
                  { k: "whatsapp", l: "I agree to receive WhatsApp / SMS updates from Incline." },
                  { k: "photo", l: "I consent to my photo being used for member identification (optional)." },
                ].map(c => (
                  <label key={c.k} className="flex items-start gap-2 text-xs text-slate-300">
                    <Checkbox checked={(consents as Record<string, boolean>)[c.k]} onCheckedChange={(v) => setConsents(s => ({ ...s, [c.k]: !!v }))} className="mt-0.5" />
                    <span>{c.l}</span>
                  </label>
                ))}
              </div>

              <div>
                <Label className="text-xs text-slate-400">Sign below (Apple Pencil supported)</Label>
                <SignaturePad ref={sigRef} />
                <button type="button" className="mt-2 text-xs text-indigo-300 underline" onClick={() => sigRef.current?.clear()}>Clear</button>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1 border-white/10 bg-transparent text-slate-100 hover:bg-white/5" onClick={() => setStep("parq")}>Back</Button>
                <Button type="button" className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600" onClick={submitSign} disabled={sendOtp.isPending}>
                  {sendOtp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send OTP
                </Button>
              </div>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Verify your number</h2>
              <p className="text-sm text-slate-400">Enter the 6-digit code sent to {details?.phone} on WhatsApp.</p>
              <div className="flex justify-center">
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="border-white/20 bg-white/5 text-slate-100" />)}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <Button type="button" className="w-full bg-gradient-to-r from-indigo-500 to-violet-600" disabled={otp.length !== 6 || verifyAndRegister.isPending} onClick={() => verifyAndRegister.mutate()}>
                {verifyAndRegister.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Verify & complete
              </Button>
              <button type="button" className="block w-full text-center text-xs text-indigo-300" onClick={() => sendOtp.mutate(details!.phone)} disabled={sendOtp.isPending}>Resend code</button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 text-center">
              <ShieldCheck className="mx-auto h-12 w-12 text-emerald-400" />
              <h2 className="text-lg font-semibold">You're in!</h2>
              <p className="text-sm text-slate-400">Visit reception to activate your plan. Redirecting…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-slate-400">{label}</Label>
      <div className="mt-1">{children}</div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
