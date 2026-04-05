import { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CheckCircle, Loader2, ChevronRight, ChevronLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

const leadSchema = z.object({
  full_name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  phone: z.string().trim().min(10, 'Enter a valid phone number').max(15).regex(/^\+?\d{10,15}$/, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email').max(255),
  age: z.string().trim().min(1, 'Select your age range'),
  area: z.string().trim().min(2, 'Enter your area/locality').max(100),
  city: z.string().trim().min(2, 'Enter your city').max(100),
  plan: z.string().trim().min(1, 'Select a plan preference'),
  frequency: z.string().trim().min(1, 'Select your gym frequency'),
});

type LeadFormData = z.infer<typeof leadSchema>;

const getSource = (): string => {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get('utm_source');
    if (utm) return utm;
    const ref = document.referrer || '';
    if (ref.includes('instagram')) return 'instagram';
    if (ref.includes('facebook')) return 'facebook';
    if (ref.includes('twitter') || ref.includes('x.com')) return 'twitter';
    if (ref.includes('youtube')) return 'youtube';
    if (ref.includes('linkedin')) return 'linkedin';
  } catch {}
  return 'website';
};

const AGE_RANGES = ['18-24', '25-30', '31-35', '36-40', '41-50', '50+'];
const FREQUENCIES = [
  { value: 'daily', label: '🔥 Daily', desc: 'Every single day' },
  { value: '4-5x', label: '💪 4-5x/week', desc: 'Serious commitment' },
  { value: '2-3x', label: '⚡ 2-3x/week', desc: 'Balanced routine' },
  { value: '1x', label: '🌱 Once a week', desc: 'Just starting out' },
  { value: 'new', label: '✨ New to fitness', desc: 'Ready to begin' },
];

const RegisterModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1);

  const { register, handleSubmit, reset, control, trigger, formState: { errors } } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: { plan: '', frequency: '', age: '' },
  });

  useEffect(() => {
    const handleOpen = () => {
      setIsSuccess(false);
      setStep(1);
      reset();
      setIsOpen(true);
    };
    window.addEventListener('open-register-modal', handleOpen);
    return () => window.removeEventListener('open-register-modal', handleOpen);
  }, [reset]);

  const goToStep2 = async () => {
    const valid = await trigger(['full_name', 'phone', 'email']);
    if (valid) setStep(2);
  };

  const buildNotes = (data: LeadFormData): string => {
    return [
      `Age: ${data.age}`,
      `Location: ${data.area}, ${data.city}`,
      `Plan Interest: ${data.plan === 'annual' ? 'Annual' : data.plan === 'quarterly' ? 'Quarterly' : 'Monthly'}`,
      `Gym Frequency: ${FREQUENCIES.find(f => f.value === data.frequency)?.label || data.frequency}`,
    ].join(' | ');
  };

  const onSubmit = async (data: LeadFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('capture-lead', {
        body: {
          full_name: data.full_name,
          phone: data.phone,
          email: data.email,
          source: getSource(),
          notes: buildNotes(data),
        },
      });
      if (error) throw error;
      setIsSuccess(true);
      reset();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stepIndicator = (
    <div className="flex items-center justify-center gap-2 pb-2">
      <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 1 ? 'w-8 bg-primary' : 'w-4 bg-muted'}`} />
      <div className={`h-1.5 rounded-full transition-all duration-300 ${step === 2 ? 'w-8 bg-primary' : 'w-4 bg-muted'}`} />
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md bg-card border-border p-0 overflow-hidden max-h-[90dvh] overflow-y-auto">
        {isSuccess ? (
          <div className="p-8 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-in zoom-in-50 duration-300">
              <CheckCircle className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-2xl font-black text-foreground">You're In!</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Welcome to the INCLINE founding members list. We'll reach out with exclusive updates and early access details.
            </p>
            <button onClick={() => setIsOpen(false)} className="mt-2 px-6 py-3 bg-primary text-primary-foreground font-bold text-sm tracking-wider uppercase rounded-xl hover:bg-primary/90 transition-colors">
              Done
            </button>
          </div>
        ) : (
          <>
            <DialogHeader className="p-6 pb-0">
              <DialogTitle className="text-xl font-black text-foreground">
                {step === 1 ? (<>Join the <span className="text-primary">INCLINE</span> Waitlist</>) : (<>Tell us about <span className="text-primary">You</span></>)}
              </DialogTitle>
              <p className="text-muted-foreground text-sm mt-1">
                {step === 1 ? 'Secure your spot as a founding member.' : 'Help us personalize your experience.'}
              </p>
              {stepIndicator}
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-2 space-y-4">
              {step === 1 && (
                <div className="space-y-4 animate-in slide-in-from-left-4 duration-200">
                  <div className="space-y-1.5">
                    <Label htmlFor="full_name" className="text-foreground text-sm font-semibold">Full Name *</Label>
                    <Input id="full_name" placeholder="John Doe" {...register('full_name')} className="bg-background border-border" />
                    {errors.full_name && <p className="text-destructive text-xs">{errors.full_name.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-foreground text-sm font-semibold">Phone *</Label>
                    <Input id="phone" type="tel" placeholder="+919876543210" {...register('phone')} className="bg-background border-border" />
                    {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-foreground text-sm font-semibold">Email *</Label>
                    <Input id="email" type="email" placeholder="john@example.com" {...register('email')} className="bg-background border-border" />
                    {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
                  </div>
                  <button type="button" onClick={goToStep2} className="w-full px-6 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wider uppercase rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl flex items-center justify-center gap-2">
                    Next <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
              {step === 2 && (
                <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-sm font-semibold">Age Range *</Label>
                    <Controller control={control} name="age" render={({ field }) => (
                      <div className="flex flex-wrap gap-2">
                        {AGE_RANGES.map((range) => (
                          <button key={range} type="button" onClick={() => field.onChange(range)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${field.value === range ? 'bg-primary text-primary-foreground border-primary scale-105' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
                            {range}
                          </button>
                        ))}
                      </div>
                    )} />
                    {errors.age && <p className="text-destructive text-xs">{errors.age.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="area" className="text-foreground text-sm font-semibold">Area *</Label>
                      <Input id="area" placeholder="Koramangala" {...register('area')} className="bg-background border-border" />
                      {errors.area && <p className="text-destructive text-xs">{errors.area.message}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="text-foreground text-sm font-semibold">City *</Label>
                      <Input id="city" placeholder="Bangalore" {...register('city')} className="bg-background border-border" />
                      {errors.city && <p className="text-destructive text-xs">{errors.city.message}</p>}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-sm font-semibold">Membership Plan Interest *</Label>
                    <Controller control={control} name="plan" render={({ field }) => (
                      <div className="grid grid-cols-3 gap-2">
                        {[{ value: 'monthly', label: 'Monthly', icon: '📅' }, { value: 'quarterly', label: 'Quarterly', icon: '🗓️' }, { value: 'annual', label: 'Annual', icon: '🏆' }].map((option) => (
                          <button key={option.value} type="button" onClick={() => field.onChange(option.value)}
                            className={`flex flex-col items-center gap-1 p-3 rounded-xl border text-xs font-semibold transition-all duration-200 ${field.value === option.value ? 'bg-primary/10 text-primary border-primary scale-105 shadow-md' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
                            <span className="text-lg">{option.icon}</span>{option.label}
                          </button>
                        ))}
                      </div>
                    )} />
                    {errors.plan && <p className="text-destructive text-xs">{errors.plan.message}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-foreground text-sm font-semibold">How often do you work out? *</Label>
                    <Controller control={control} name="frequency" render={({ field }) => (
                      <div className="space-y-1.5">
                        {FREQUENCIES.map((freq) => (
                          <button key={freq.value} type="button" onClick={() => field.onChange(freq.value)}
                            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left transition-all duration-200 ${field.value === freq.value ? 'bg-primary/10 border-primary shadow-sm' : 'bg-background border-border hover:border-primary/50'}`}>
                            <span className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{freq.label}</span>
                              <span className="text-xs text-muted-foreground">{freq.desc}</span>
                            </span>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${field.value === freq.value ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                              {field.value === freq.value && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
                            </div>
                          </button>
                        ))}
                      </div>
                    )} />
                    {errors.frequency && <p className="text-destructive text-xs">{errors.frequency.message}</p>}
                  </div>
                  <div className="flex gap-3 pt-1">
                    <button type="button" onClick={() => setStep(1)} className="px-4 py-3.5 border border-border text-foreground font-bold text-sm tracking-wider uppercase rounded-xl hover:bg-muted transition-colors flex items-center gap-1">
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                    <button type="submit" disabled={isSubmitting} className="flex-1 px-6 py-3.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm tracking-wider uppercase rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                      {isSubmitting ? (<><Loader2 className="w-4 h-4 animate-spin" />Submitting...</>) : 'Join Waitlist 🚀'}
                    </button>
                  </div>
                  <p className="text-center text-muted-foreground text-xs">We'll never share your info. Founding members get priority access.</p>
                </div>
              )}
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RegisterModal;
