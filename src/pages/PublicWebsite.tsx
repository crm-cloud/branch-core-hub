import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dumbbell,
  Users,
  Activity,
  Clock,
  Star,
  ChevronRight,
  Instagram,
  Facebook,
  Twitter,
  Youtube,
  Phone,
  Mail,
  MapPin,
  Check,
  ArrowRight,
  Loader2,
  Play,
  Zap,
  Shield,
  Trophy,
  Target,
  Heart,
  TrendingUp,
  Award,
  ChevronDown,
  Menu,
  X,
  Flame,
  Sparkles,
  BarChart3,
  Bike,
  Waves,
  MessageCircle,
  Quote,
  Calendar,
} from 'lucide-react';
import { cmsService, ThemeSettings } from '@/services/cmsService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const TRAINERS = [
  { name: 'Vikram Mehta', role: 'Head Strength Coach', exp: '12 yrs', img: 'https://images.pexels.com/photos/1431282/pexels-photo-1431282.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'Neha Sharma', role: 'Yoga & Wellness Expert', exp: '8 yrs', img: 'https://images.pexels.com/photos/3823488/pexels-photo-3823488.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'Arjun Kapoor', role: 'HIIT & Cardio Specialist', exp: '10 yrs', img: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'Riya Patel', role: 'Nutrition & Lifestyle Coach', exp: '6 yrs', img: 'https://images.pexels.com/photos/3076509/pexels-photo-3076509.jpeg?auto=compress&cs=tinysrgb&w=400' },
];

const STATS = [
  { value: '2,500+', label: 'Active Members', icon: Users },
  { value: '98%', label: 'Satisfaction Rate', icon: Heart },
  { value: '25+', label: 'Expert Trainers', icon: Trophy },
  { value: '15+', label: 'Branches', icon: MapPin },
];


const CLASSES = [
  { name: 'HIIT Blast', time: '6:00 AM', duration: '45 min', icon: Flame, color: 'from-orange-500 to-red-500', spots: 4 },
  { name: 'Power Yoga', time: '7:30 AM', duration: '60 min', icon: Waves, color: 'from-teal-500 to-cyan-500', spots: 8 },
  { name: 'Spin Cycle', time: '9:00 AM', duration: '45 min', icon: Bike, color: 'from-blue-500 to-indigo-500', spots: 2 },
  { name: 'Strength Pro', time: '5:30 PM', duration: '60 min', icon: Dumbbell, color: 'from-amber-500 to-orange-500', spots: 6 },
  { name: 'Zumba Dance', time: '6:30 PM', duration: '45 min', icon: Activity, color: 'from-pink-500 to-rose-500', spots: 10 },
  { name: 'Core & Flex', time: '7:30 PM', duration: '30 min', icon: Target, color: 'from-emerald-500 to-green-500', spots: 5 },
];

const FAQS = [
  { q: 'Do you offer a free trial?', a: 'Yes! We offer a complimentary 3-day trial pass so you can experience our facilities and classes before committing to a membership.' },
  { q: 'What are your operating hours?', a: 'We are open 24/7. Our staffed hours are 5:30 AM – 11:00 PM on weekdays and 6:00 AM – 9:00 PM on weekends.' },
  { q: 'Can I freeze my membership?', a: 'Absolutely. You can freeze your membership for up to 90 days per year with no extra charges. Perfect for travel or recovery.' },
  { q: 'Do you provide personal training?', a: 'Yes, we have certified personal trainers available for 1-on-1 sessions. PT packages start from ₹3,000/session with discounts for bundles.' },
  { q: 'Is parking available?', a: 'Yes, we have free parking for up to 100 vehicles at our main branch with dedicated two-wheeler spaces as well.' },
  { q: 'Can I switch between branches?', a: 'Yes! Our Premium and Annual plans include access to all branches. You can work out at any location across our network.' },
];

const FEATURES_ADVANCED = [
  { icon: BarChart3, title: 'Progress Tracking', desc: 'AI-powered analytics monitor your gains, body measurements, and performance metrics weekly.', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30' },
  { icon: Zap, title: 'Smart Nutrition', desc: 'Personalized diet plans crafted by certified nutritionists aligned with your fitness goals.', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30' },
  { icon: Shield, title: 'Safety First', desc: 'CCTV monitored, trained staff on duty, and world-class equipment maintained bi-weekly.', color: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30' },
  { icon: Sparkles, title: 'AI Fitness Coach', desc: 'Get 24/7 personalized workout recommendations powered by machine learning and real data.', color: 'from-rose-500/20 to-pink-500/20', border: 'border-rose-500/30' },
  { icon: TrendingUp, title: 'Recovery Science', desc: 'Ice baths, stretching zones, foam rolling stations, and recovery tracking built in.', color: 'from-teal-500/20 to-cyan-500/20', border: 'border-teal-500/30' },
  { icon: Award, title: 'Reward Program', desc: 'Earn points for every visit, class, and referral. Redeem for merchandise and session credits.', color: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/30' },
];

export default function PublicWebsite() {
  const [theme, setTheme] = useState<ThemeSettings>(cmsService.getDefaultTheme());
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [leadForm, setLeadForm] = useState({ fullName: '', phone: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [countersVisible, setCountersVisible] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(cmsService.getTheme());
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (heroRef.current) {
        const rect = heroRef.current.getBoundingClientRect();
        setMousePosition({
          x: (e.clientX - rect.left) / rect.width,
          y: (e.clientY - rect.top) / rect.height,
        });
      }
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useEffect(() => {
    if (!statsRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setCountersVisible(true); },
      { threshold: 0.3 }
    );
    observer.observe(statsRef.current);
    return () => observer.disconnect();
  }, []);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.fullName.trim() || !leadForm.phone.trim()) {
      toast.error('Please enter your name and phone number');
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('capture-lead', {
        body: {
          fullName: leadForm.fullName.trim(),
          phone: leadForm.phone.trim(),
          email: leadForm.email.trim() || undefined,
          source: 'website',
        },
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Thank you! We will contact you soon.');
      setLeadForm({ fullName: '', phone: '', email: '' });
    } catch {
      toast.error('Failed to submit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#080810] text-white overflow-x-hidden font-sans">

      {/* ── NAVIGATION ── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? 'bg-[#080810]/95 backdrop-blur-2xl border-b border-white/[0.06] shadow-2xl shadow-black/50'
            : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Dumbbell className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <span className="text-lg font-black tracking-tight">{theme.gymName}</span>
          </div>

          <div className="hidden lg:flex items-center gap-8" role="navigation" aria-label="Main navigation">
            {[
              { id: 'features', label: 'Features' },
              { id: 'classes', label: 'Classes' },
              { id: 'trainers', label: 'Trainers' },
              { id: 'pricing', label: 'Pricing' },
              { id: 'testimonials', label: 'Reviews' },
              { id: 'contact', label: 'Contact' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-sm text-white/70 hover:text-white transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:rounded"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden sm:block">
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white hover:bg-white/10 hover:border-white/40 transition-all"
              >
                Sign In
              </Button>
            </Link>
            <button
              onClick={() => scrollTo('contact')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            >
              Free Trial
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div
          className={`lg:hidden transition-all duration-300 overflow-hidden ${mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
          aria-hidden={!mobileMenuOpen}
        >
          <div className="px-4 pb-4 pt-2 bg-[#080810]/98 backdrop-blur-2xl border-b border-white/[0.06] flex flex-col gap-1">
            {[
              { id: 'features', label: 'Features' },
              { id: 'classes', label: 'Classes' },
              { id: 'trainers', label: 'Trainers' },
              { id: 'pricing', label: 'Pricing' },
              { id: 'testimonials', label: 'Reviews' },
              { id: 'contact', label: 'Contact' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className="text-left py-3 px-4 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium"
              >
                {item.label}
              </button>
            ))}
            <div className="flex gap-2 mt-2 pt-2 border-t border-white/10">
              <Link to="/auth" className="flex-1">
                <Button variant="outline" size="sm" className="w-full border-white/20 text-white hover:bg-white/10">Sign In</Button>
              </Link>
              <button
                onClick={() => scrollTo('contact')}
                className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-sm font-semibold text-white"
              >
                Free Trial
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ── */}
      <section
        id="hero"
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(251,146,60,0.15) 0%, transparent 60%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(239,68,68,0.1) 0%, transparent 50%), #080810' }}
      >
        {/* Animated background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div
            className="absolute w-[600px] h-[600px] rounded-full opacity-30"
            style={{
              background: 'radial-gradient(circle, rgba(251,146,60,0.3) 0%, transparent 70%)',
              left: `${30 + mousePosition.x * 8}%`,
              top: `${20 + mousePosition.y * 8}%`,
              transform: 'translate(-50%, -50%)',
              transition: 'left 0.8s ease-out, top 0.8s ease-out',
            }}
          />
          <div
            className="absolute w-[400px] h-[400px] rounded-full opacity-20"
            style={{
              background: 'radial-gradient(circle, rgba(239,68,68,0.4) 0%, transparent 70%)',
              right: `${10 + mousePosition.x * 5}%`,
              bottom: `${20 + mousePosition.y * 5}%`,
              transition: 'right 0.8s ease-out, bottom 0.8s ease-out',
            }}
          />
          {/* Noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />
          {/* Grid */}
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '80px 80px',
            }}
          />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-8 animate-pulse">
                <Flame className="h-4 w-4" aria-hidden="true" />
                Limited: 50% OFF First Month — 48 hrs left
              </div>

              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight mb-6">
                <span className="text-white">FORGE YOUR</span>
                <br />
                <span
                  className="text-transparent bg-clip-text"
                  style={{ backgroundImage: 'linear-gradient(135deg, #f97316, #ef4444, #ec4899)' }}
                >
                  BEST BODY
                </span>
                <br />
                <span className="text-white/90">IN 2026</span>
              </h1>

              <p className="text-lg sm:text-xl text-white/60 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                India's most advanced gym management platform meets world-class facilities. AI coaching, expert trainers, and a community that pushes you further.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-12">
                <button
                  onClick={() => scrollTo('contact')}
                  className="group flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-lg shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 active:scale-100 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080810]"
                >
                  Start Free Trial
                  <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </button>
                <button
                  onClick={() => setVideoPlaying(true)}
                  className="group flex items-center justify-center gap-3 px-8 py-4 rounded-2xl border border-white/20 text-white font-semibold text-lg hover:bg-white/5 hover:border-white/40 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    <Play className="h-4 w-4 ml-0.5" aria-hidden="true" />
                  </div>
                  Watch Tour
                </button>
              </div>

              {/* Trust bar */}
              <div className="flex flex-wrap items-center gap-6 justify-center lg:justify-start text-sm text-white/40">
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-400" aria-hidden="true" /> No credit card</span>
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-400" aria-hidden="true" /> Cancel anytime</span>
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-400" aria-hidden="true" /> Free 3-day pass</span>
              </div>
            </div>

            {/* Hero visual - gym cards stack */}
            <div className="relative hidden lg:flex items-center justify-center">
              <div
                className="relative w-full max-w-sm"
                style={{
                  transform: `perspective(800px) rotateY(${(mousePosition.x - 0.5) * -10}deg) rotateX(${(mousePosition.y - 0.5) * 6}deg)`,
                  transition: 'transform 0.3s ease-out',
                }}
              >
                {/* Main card */}
                <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10">
                  <img
                    src="https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600"
                    alt="Gym training"
                    className="w-full h-80 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-white/60 mb-1">Today's Highlight</div>
                        <div className="text-white font-bold">HIIT Blast — 6:00 AM</div>
                      </div>
                      <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg">
                        <Flame className="h-6 w-6 text-white" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating stat cards */}
                <div className="absolute -top-6 -right-8 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl">
                  <div className="text-2xl font-black text-orange-400">2,500+</div>
                  <div className="text-xs text-white/60">Active Members</div>
                </div>
                <div className="absolute -bottom-6 -left-8 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 shadow-xl">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-7 w-7 rounded-full bg-gradient-to-br from-orange-400 to-red-500 border-2 border-[#080810]" />
                      ))}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">42 checking in</div>
                      <div className="text-xs text-white/50">right now</div>
                    </div>
                  </div>
                </div>
                <div className="absolute top-1/2 -left-10 -translate-y-1/2 px-3 py-2 rounded-xl bg-green-500/20 backdrop-blur-xl border border-green-500/30 shadow-xl">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" aria-label="Live" />
                    <span className="text-xs font-semibold text-green-400">LIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll hint */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-xs" aria-hidden="true">
            <span>Scroll to explore</span>
            <ChevronDown className="h-5 w-5 animate-bounce" />
          </div>
        </div>
      </section>

      {/* ── SOCIAL PROOF BANNER ── */}
      <div className="py-5 bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 border-y border-orange-500/20 overflow-hidden">
        <div className="flex items-center gap-12 animate-marquee whitespace-nowrap">
          {[...Array(3)].map((_, gi) => (
            <div key={gi} className="flex items-center gap-12 shrink-0">
              {['GOOGLE 4.9★', '10,000+ TRANSFORMATIONS', 'VOTED BEST GYM 2025', 'ISO CERTIFIED', 'TRAINED ATHLETES', '24/7 SUPPORT'].map((text) => (
                <span key={text} className="text-sm font-bold text-orange-400/70 tracking-widest uppercase flex items-center gap-3">
                  <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {text}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS COUNTER ── */}
      <section ref={statsRef} className="py-20 bg-[#080810]" aria-label="Key statistics">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, label, icon: Icon }) => (
              <div
                key={label}
                className={`p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center group hover:border-orange-500/30 transition-all duration-300 ${countersVisible ? 'animate-fade-in-up' : 'opacity-0'}`}
              >
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-500/20 transition-colors">
                  <Icon className="h-6 w-6 text-orange-400" aria-hidden="true" />
                </div>
                <div className="text-4xl font-black text-white mb-1">{value}</div>
                <div className="text-sm text-white/50">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES SECTION ── */}
      <section id="features" className="py-24 bg-[#0c0c14]" aria-label="Features">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
              <Zap className="h-4 w-4" aria-hidden="true" />
              Everything You Need
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Built for Champions</h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">World-class facilities combined with cutting-edge technology to accelerate your results.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES_ADVANCED.map(({ icon: Icon, title, desc, color, border }) => (
              <div
                key={title}
                className={`group p-6 rounded-2xl bg-gradient-to-br ${color} border ${border} hover:scale-[1.02] hover:shadow-xl transition-all duration-300 cursor-default`}
              >
                <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Feature highlight with image */}
          <div className="mt-12 grid lg:grid-cols-2 gap-8 items-center p-8 rounded-3xl bg-gradient-to-br from-orange-500/10 to-red-600/5 border border-orange-500/20">
            <div>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 mb-4">AI Powered</Badge>
              <h3 className="text-3xl font-black text-white mb-4">Your Personal AI Fitness Coach</h3>
              <p className="text-white/60 mb-6 leading-relaxed">
                Our AI analyzes your performance data, sleep patterns, and nutrition to deliver hyper-personalized workout recommendations. 3x better results than generic plans.
              </p>
              <ul className="space-y-3">
                {['Adaptive workout plans that evolve with you', 'Real-time form correction via camera', 'Nutrition timing and meal suggestions', 'Recovery optimization & injury prevention'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70">
                    <Check className="h-4 w-4 text-orange-400 shrink-0" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <img
                src="https://images.pexels.com/photos/3823488/pexels-photo-3823488.jpeg?auto=compress&cs=tinysrgb&w=600"
                alt="AI fitness coaching in action"
                className="w-full rounded-2xl object-cover h-72"
              />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-[#080810]/60 to-transparent" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      {/* ── CLASSES SCHEDULE ── */}
      <section id="classes" className="py-24 bg-[#080810]" aria-label="Class schedule">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Today's Schedule
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">50+ Weekly Classes</h2>
            <p className="text-lg text-white/50">From high-intensity to mindful movement — find your perfect class.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {CLASSES.map(({ name, time, duration, icon: Icon, color, spots }) => (
              <div
                key={name}
                className="group p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/20 hover:bg-white/[0.05] transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  <div className={`px-2 py-1 rounded-lg text-xs font-semibold ${spots <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                    {spots <= 3 ? `${spots} spots left!` : `${spots} open`}
                  </div>
                </div>
                <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
                <div className="flex items-center gap-4 text-sm text-white/50">
                  <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" aria-hidden="true" />{time}</span>
                  <span>{duration}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => scrollTo('contact')}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/5 transition-all"
            >
              View Full Schedule
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>

      {/* ── TRAINERS SECTION ── */}
      <section id="trainers" className="py-24 bg-[#0c0c14]" aria-label="Our trainers">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
              <Trophy className="h-4 w-4" aria-hidden="true" />
              Expert Team
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">World-Class Trainers</h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">Certified experts dedicated to your transformation, every session.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TRAINERS.map((trainer) => (
              <div
                key={trainer.name}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.06] hover:border-orange-500/30 transition-all duration-300 cursor-pointer"
              >
                <div className="aspect-[3/4] overflow-hidden">
                  <img
                    src={trainer.img}
                    alt={`${trainer.name}, ${trainer.role}`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" aria-hidden="true" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <div className="text-white font-bold text-lg">{trainer.name}</div>
                  <div className="text-white/60 text-sm mb-2">{trainer.role}</div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium">{trainer.exp} exp</span>
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-orange-400 text-orange-400" aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY / FACILITY STRIP ── */}
      <section className="py-8 overflow-hidden" aria-label="Facility gallery">
        <div className="flex gap-4 overflow-hidden">
          {[
            'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600',
            'https://images.pexels.com/photos/3823488/pexels-photo-3823488.jpeg?auto=compress&cs=tinysrgb&w=600',
            'https://images.pexels.com/photos/1431282/pexels-photo-1431282.jpeg?auto=compress&cs=tinysrgb&w=600',
            'https://images.pexels.com/photos/3076509/pexels-photo-3076509.jpeg?auto=compress&cs=tinysrgb&w=600',
            'https://images.pexels.com/photos/6975489/pexels-photo-6975489.jpeg?auto=compress&cs=tinysrgb&w=600',
            'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600',
          ].map((url, i) => (
            <div key={i} className="shrink-0 w-72 h-48 rounded-2xl overflow-hidden border border-white/10">
              <img src={url} alt={`Facility view ${i + 1}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING SECTION ── */}
      <section id="pricing" className="py-24 bg-[#0c0c14]" aria-label="Pricing plans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
              <Target className="h-4 w-4" aria-hidden="true" />
              Membership Plans
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-white/50">No hidden fees. Cancel anytime.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {theme.pricingPlans.map((plan, idx) => (
              <div
                key={plan.name}
                className={`relative p-7 rounded-3xl border transition-all duration-300 hover:scale-[1.02] ${
                  plan.isPopular
                    ? 'bg-gradient-to-b from-orange-500/20 to-red-600/10 border-orange-500/40 shadow-2xl shadow-orange-500/20'
                    : 'bg-white/[0.03] border-white/[0.08] hover:border-white/20'
                }`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold shadow-lg shadow-orange-500/30">
                    MOST POPULAR
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
                  <div className="text-white/50 text-sm">{plan.duration}</div>
                </div>
                <div className="mb-7">
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-black text-white">₹{plan.price.toLocaleString()}</span>
                    <span className="text-white/40 text-sm mb-2">/{plan.duration.split(' ')[0] === '1' ? 'mo' : plan.duration.includes('3') ? '3mo' : 'yr'}</span>
                  </div>
                  {plan.isPopular && <div className="text-xs text-orange-400 mt-1 font-medium">Save 33% vs monthly</div>}
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-3 text-sm text-white/70">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${plan.isPopular ? 'bg-orange-500/20' : 'bg-white/10'}`}>
                        <Check className="h-3 w-3 text-orange-400" aria-hidden="true" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => scrollTo('contact')}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all ${
                    plan.isPopular
                      ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-[1.02]'
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  Get Started
                </button>
              </div>
            ))}
          </div>

          {/* Money back guarantee */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-white/40">
            <span className="flex items-center gap-2"><Shield className="h-4 w-4 text-green-400" aria-hidden="true" /> 30-day money-back guarantee</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" aria-hidden="true" /> No setup fees</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" aria-hidden="true" /> Freeze anytime</span>
            <span className="flex items-center gap-2"><Check className="h-4 w-4 text-green-400" aria-hidden="true" /> Multi-branch access</span>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section id="testimonials" className="py-24 bg-[#080810]" aria-label="Member testimonials">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
              <Heart className="h-4 w-4" aria-hidden="true" />
              Success Stories
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Real Results, Real People</h2>
            <p className="text-lg text-white/50">Join thousands who've already transformed with us.</p>
          </div>

          {/* Review score bar */}
          <div className="flex flex-col sm:flex-row items-center gap-6 justify-center mb-12 p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] max-w-2xl mx-auto">
            <div className="text-center sm:text-left">
              <div className="text-6xl font-black text-white">4.9</div>
              <div className="flex gap-1 my-2 justify-center sm:justify-start">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-orange-400 text-orange-400" aria-hidden="true" />
                ))}
              </div>
              <div className="text-white/50 text-sm">Based on 2,400+ reviews</div>
            </div>
            <div className="w-px h-16 bg-white/10 hidden sm:block" aria-hidden="true" />
            <div className="flex flex-col gap-2 w-full max-w-xs">
              {[['5 stars', '87%'], ['4 stars', '10%'], ['3 stars', '2%'], ['2 stars', '1%']].map(([label, pct]) => (
                <div key={label} className="flex items-center gap-3 text-xs">
                  <span className="text-white/50 w-12 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full rounded-full bg-orange-500" style={{ width: pct }} aria-label={pct} />
                  </div>
                  <span className="text-white/50 w-8 shrink-0 text-right">{pct}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              ...theme.testimonials,
              { name: 'Suresh P.', quote: 'The 24/7 access is a game-changer. I train at 5 AM with no issues!', image: '' },
              { name: 'Kavya R.', quote: 'Yoga classes here are on another level. The instructors are world-class.', image: '' },
              { name: 'Deepak N.', quote: 'Lost 15kg in 4 months with the AI nutrition plan. Worth every rupee.', image: '' },
            ].slice(0, 6).map((t) => (
              <div
                key={t.name}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/20 transition-all duration-300 group"
              >
                <Quote className="h-8 w-8 text-orange-500/30 mb-4" aria-hidden="true" />
                <p className="text-white/80 text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{t.name}</div>
                    <div className="flex gap-0.5 mt-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-orange-400 text-orange-400" aria-hidden="true" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ SECTION ── */}
      <section className="py-24 bg-[#0c0c14]" aria-label="Frequently asked questions">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
              <MessageCircle className="h-4 w-4" aria-hidden="true" />
              FAQ
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Got Questions?</h2>
            <p className="text-lg text-white/50">Everything you need to know about joining.</p>
          </div>

          <div className="space-y-3" role="list">
            {FAQS.map((faq, i) => (
              <div
                key={i}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${openFaq === i ? 'border-orange-500/30 bg-orange-500/5' : 'border-white/[0.06] bg-white/[0.02]'}`}
                role="listitem"
              >
                <button
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-inset"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  aria-expanded={openFaq === i}
                >
                  <span className="font-semibold text-white text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown
                    className={`h-5 w-5 text-orange-400 shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                <div className={`transition-all duration-300 ${openFaq === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="px-6 pb-5 text-sm text-white/60 leading-relaxed">{faq.a}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT / CTA SECTION ── */}
      <section id="contact" className="py-24 bg-[#080810]" aria-label="Contact and free trial">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Big CTA banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500/20 via-red-600/15 to-transparent border border-orange-500/20 p-10 sm:p-14 mb-16 text-center">
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute top-0 left-1/4 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
              <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" />
            </div>
            <div className="relative">
              <h2 className="text-4xl sm:text-6xl font-black text-white mb-4">
                Your Transformation<br />
                <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #f97316, #ef4444)' }}>
                  Starts Today
                </span>
              </h2>
              <p className="text-white/60 text-lg max-w-xl mx-auto mb-8">
                Join 2,500+ members who transformed their lives. First 3 days are on us.
              </p>
              <button
                onClick={() => document.getElementById('lead-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-xl shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
              >
                Claim Free 3-Day Pass
                <ArrowRight className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Contact info */}
            <div>
              <h3 className="text-2xl font-black text-white mb-8">Find Us</h3>
              <div className="space-y-5">
                {[
                  { icon: MapPin, label: 'Address', value: theme.address, color: 'text-orange-400' },
                  { icon: Phone, label: 'Phone', value: theme.contactPhone, color: 'text-green-400' },
                  { icon: Mail, label: 'Email', value: theme.contactEmail, color: 'text-blue-400' },
                  { icon: Clock, label: 'Hours', value: 'Mon–Fri: 5:30 AM–11 PM | Sat–Sun: 6 AM–9 PM', color: 'text-amber-400' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                      <Icon className={`h-5 w-5 ${color}`} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="text-xs text-white/40 mb-1">{label}</div>
                      <div className="text-white text-sm font-medium">{value}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Social */}
              <div className="flex gap-3 mt-8">
                {[
                  { icon: Instagram, href: theme.socialLinks.instagram, label: 'Instagram' },
                  { icon: Facebook, href: theme.socialLinks.facebook, label: 'Facebook' },
                  { icon: Twitter, href: theme.socialLinks.twitter, label: 'Twitter' },
                  { icon: Youtube, href: theme.socialLinks.youtube, label: 'YouTube' },
                ].filter(s => s.href).map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Follow us on ${label}`}
                    className="h-11 w-11 rounded-xl bg-white/[0.05] hover:bg-orange-500/20 border border-white/[0.06] hover:border-orange-500/30 flex items-center justify-center transition-all group"
                  >
                    <Icon className="h-5 w-5 text-white/60 group-hover:text-white transition-colors" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>

            {/* Lead form */}
            <div id="lead-form">
              <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
                <h3 className="text-2xl font-black text-white mb-2">Start Your Free Trial</h3>
                <p className="text-white/50 text-sm mb-6">3-day complimentary pass. No credit card required.</p>

                {submitted ? (
                  <div className="text-center py-10">
                    <div className="h-20 w-20 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6">
                      <Check className="h-10 w-10 text-green-400" aria-hidden="true" />
                    </div>
                    <h4 className="text-2xl font-black text-white mb-2">You're In!</h4>
                    <p className="text-white/50 text-sm">We'll call you within 2 hours to schedule your free trial session.</p>
                  </div>
                ) : (
                  <form className="space-y-4" onSubmit={handleLeadSubmit} noValidate>
                    <div>
                      <label htmlFor="fullName" className="block text-xs font-medium text-white/50 mb-1.5">Full Name *</label>
                      <input
                        id="fullName"
                        type="text"
                        placeholder="Rahul Sharma"
                        value={leadForm.fullName}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, fullName: e.target.value }))}
                        className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/25 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
                        required
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className="block text-xs font-medium text-white/50 mb-1.5">Phone Number *</label>
                      <input
                        id="phone"
                        type="tel"
                        placeholder="+91 98765 43210"
                        value={leadForm.phone}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/25 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
                        required
                        autoComplete="tel"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-xs font-medium text-white/50 mb-1.5">Email Address <span className="text-white/25">(optional)</span></label>
                      <input
                        id="email"
                        type="email"
                        placeholder="rahul@example.com"
                        value={leadForm.email}
                        onChange={(e) => setLeadForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/25 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-sm"
                        autoComplete="email"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-base shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080810]"
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                          Submitting...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          Claim Free Trial Pass
                          <ArrowRight className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                    </button>
                    <p className="text-center text-xs text-white/25">By submitting, you agree to our Privacy Policy. We never spam.</p>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#050508] border-t border-white/[0.05]" aria-label="Site footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Dumbbell className="h-5 w-5 text-white" aria-hidden="true" />
                </div>
                <span className="font-black text-white">{theme.gymName}</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed mb-4">{theme.gymTagline}</p>
              <div className="flex gap-2">
                {[
                  { icon: Instagram, href: theme.socialLinks.instagram, label: 'Instagram' },
                  { icon: Facebook, href: theme.socialLinks.facebook, label: 'Facebook' },
                  { icon: Twitter, href: theme.socialLinks.twitter, label: 'Twitter' },
                  { icon: Youtube, href: theme.socialLinks.youtube, label: 'YouTube' },
                ].filter(s => s.href).map(({ icon: Icon, href, label }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={`Follow us on ${label}`} className="h-8 w-8 rounded-lg bg-white/[0.05] hover:bg-white/10 flex items-center justify-center transition-colors">
                    <Icon className="h-4 w-4 text-white/40 hover:text-white transition-colors" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </div>

            {[
              { title: 'Company', links: [{ label: 'About Us', href: '#' }, { label: 'Careers', href: '#' }, { label: 'Blog', href: '#' }, { label: 'Press', href: '#' }] },
              { title: 'Members', links: [{ label: 'Sign In', href: '/auth' }, { label: 'Free Trial', href: '#contact' }, { label: 'Plans', href: '#pricing' }, { label: 'Classes', href: '#classes' }] },
              { title: 'Support', links: [{ label: 'FAQ', href: '#' }, { label: 'Contact', href: '#contact' }, { label: 'Privacy Policy', href: '#' }, { label: 'Terms', href: '#' }] },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="font-bold text-white text-sm mb-4">{title}</h4>
                <ul className="space-y-2.5">
                  {links.map(({ label, href }) => (
                    <li key={label}>
                      {href.startsWith('/') || href.startsWith('http') ? (
                        href.startsWith('/') ? (
                          <Link to={href} className="text-white/40 hover:text-white text-sm transition-colors">{label}</Link>
                        ) : (
                          <a href={href} className="text-white/40 hover:text-white text-sm transition-colors">{label}</a>
                        )
                      ) : (
                        <button onClick={() => scrollTo(href.slice(1))} className="text-white/40 hover:text-white text-sm transition-colors text-left">{label}</button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/25 text-xs">
              © {new Date().getFullYear()} {theme.gymName}. All rights reserved.
            </p>
            <div className="flex items-center gap-2 text-white/25 text-xs">
              <span>Made with</span>
              <Heart className="h-3 w-3 text-red-500" aria-hidden="true" />
              <span>in India</span>
              <span className="mx-2">·</span>
              <Link to="/auth" className="hover:text-white transition-colors">Admin Login</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ── VIDEO MODAL ── */}
      {videoPlaying && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setVideoPlaying(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Gym tour video"
        >
          <button
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            onClick={() => setVideoPlaying(false)}
            aria-label="Close video"
          >
            <X className="h-5 w-5 text-white" aria-hidden="true" />
          </button>
          <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
            <img
              src="https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=1200"
              alt="Gym tour preview"
              className="w-full h-auto"
            />
            <div className="bg-[#111] px-6 py-4 text-white/60 text-sm text-center">
              Virtual tour — Book a live tour by claiming your free trial
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
