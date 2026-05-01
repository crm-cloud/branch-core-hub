import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion, useInView } from 'framer-motion';
import {
  Dumbbell, Users, Activity, Clock, Star, ChevronRight, Instagram, Facebook, Twitter, Youtube,
  Phone, Mail, MapPin, Check, ArrowRight, Loader2, Play, Zap, Shield, Trophy, Target, Heart,
  TrendingUp, Award, ChevronDown, Menu, X, Flame, Sparkles, BarChart3, Bike, Waves,
  MessageCircle, Quote, Calendar,
} from 'lucide-react';
import { cmsService, ThemeSettings } from '@/services/cmsService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

const ScannerHero3D = lazy(() => import('@/components/public/ScannerHero3D'));

const FALLBACK_TRAINERS = [
  { name: 'Vikram Mehta', role: 'Head Strength Coach', bio: '12 years of elite powerlifting and strength training.', exp: '12 yrs', img: 'https://images.pexels.com/photos/1431282/pexels-photo-1431282.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'Neha Sharma', role: 'Yoga & Wellness Expert', bio: 'Certified yoga instructor focused on mind-body harmony.', exp: '8 yrs', img: 'https://images.pexels.com/photos/3823488/pexels-photo-3823488.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'Arjun Kapoor', role: 'HIIT & Cardio Specialist', bio: 'High-intensity interval training specialist with sports science background.', exp: '10 yrs', img: 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=400' },
  { name: 'Riya Patel', role: 'Nutrition & Lifestyle Coach', bio: 'Transforms lives through science-backed nutrition and habit coaching.', exp: '6 yrs', img: 'https://images.pexels.com/photos/3076509/pexels-photo-3076509.jpeg?auto=compress&cs=tinysrgb&w=400' },
];

const FALLBACK_CLASSES = [
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
  { icon: BarChart3, title: 'Progress Tracking', desc: 'AI-powered analytics monitor your gains, body measurements, and performance metrics weekly.', color: 'from-blue-500/20 to-cyan-500/20', border: 'border-blue-500/30', glow: 'rgba(59,130,246,0.15)' },
  { icon: Zap, title: 'Smart Nutrition', desc: 'Personalized diet plans crafted by certified nutritionists aligned with your fitness goals.', color: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/30', glow: 'rgba(245,158,11,0.15)' },
  { icon: Shield, title: 'Safety First', desc: 'CCTV monitored, trained staff on duty, and world-class equipment maintained bi-weekly.', color: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/30', glow: 'rgba(16,185,129,0.15)' },
  { icon: Sparkles, title: 'AI Fitness Coach', desc: 'Get 24/7 personalized workout recommendations powered by machine learning and real data.', color: 'from-rose-500/20 to-pink-500/20', border: 'border-rose-500/30', glow: 'rgba(244,63,94,0.15)' },
  { icon: TrendingUp, title: 'Recovery Science', desc: 'Ice baths, stretching zones, foam rolling stations, and recovery tracking built in.', color: 'from-teal-500/20 to-cyan-500/20', border: 'border-teal-500/30', glow: 'rgba(20,184,166,0.15)' },
  { icon: Award, title: 'Reward Program', desc: 'Earn points for every visit, class, and referral. Redeem for merchandise and session credits.', color: 'from-violet-500/20 to-purple-500/20', border: 'border-violet-500/30', glow: 'rgba(139,92,246,0.15)' },
];

const CLASS_ICON_MAP: Record<string, any> = {
  'hiit': Flame, 'yoga': Waves, 'spin': Bike, 'cycle': Bike,
  'strength': Dumbbell, 'zumba': Activity, 'dance': Activity,
  'core': Target, 'cardio': Heart,
};
const CLASS_COLOR_MAP = [
  'from-orange-500 to-red-500', 'from-teal-500 to-cyan-500', 'from-blue-500 to-indigo-500',
  'from-amber-500 to-orange-500', 'from-pink-500 to-rose-500', 'from-emerald-500 to-green-500',
];

function getClassIcon(name: string) {
  const lower = name.toLowerCase();
  for (const [key, Icon] of Object.entries(CLASS_ICON_MAP)) {
    if (lower.includes(key)) return Icon;
  }
  return Activity;
}

function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = canvas.offsetWidth;
    let height = canvas.offsetHeight;

    canvas.width = width;
    canvas.height = height;

    const NUM_PARTICLES = 80;
    const CONNECT_DIST = 130;

    type Particle = { x: number; y: number; vx: number; vy: number; radius: number };

    const particles: Particle[] = Array.from({ length: NUM_PARTICLES }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      radius: Math.random() * 2 + 1,
    }));

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(249,115,22,0.6)';
        ctx.fill();

        for (let j = i + 1; j < particles.length; j++) {
          const q = particles[j];
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const alpha = (1 - dist / CONNECT_DIST) * 0.25;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.strokeStyle = `rgba(249,115,22,${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(draw);
    }

    draw();

    const handleResize = () => {
      width = canvas.offsetWidth;
      height = canvas.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

function FeatureCard3D({ icon: Icon, title, desc, color, border, glow, index }: any) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = ((e.clientY - cy) / (rect.height / 2)) * 5;
    const ry = ((e.clientX - cx) / (rect.width / 2)) * -5;
    setTilt({ x: rx, y: ry });
  };
  const handleMouseLeave = () => setTilt({ x: 0, y: 0 });

  const isHovered = tilt.x !== 0 || tilt.y !== 0;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        transform: `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${isHovered ? '20px' : '0px'})`,
        transition: 'transform 0.3s ease-out',
        boxShadow: isHovered ? `0 30px 60px ${glow}` : 'none',
      }}
      className={`group p-6 rounded-2xl bg-gradient-to-br ${color} border ${border} cursor-default backdrop-blur-md bg-white/[0.05]`}
    >
      <div className="h-12 w-12 rounded-xl bg-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
        <Icon className="h-6 w-6 text-white" />
      </div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/60 leading-relaxed">{desc}</p>
    </motion.div>
  );
}

function TrainerFlipCard({ trainer, idx }: { trainer: any; idx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: idx * 0.1 }}
      className="card-3d-container"
      style={{ height: '340px' }}
    >
      <div className="card-3d-inner rounded-2xl">
        <div className="card-3d-front rounded-2xl overflow-hidden border border-white/[0.06]">
          <div className="w-full h-full relative">
            <img src={trainer.img} alt={trainer.name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <div className="text-white font-bold text-lg">{trainer.name}</div>
              <div className="text-white/60 text-sm mb-2">{trainer.role}</div>
              <div className="flex items-center gap-2">
                {trainer.exp && <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-xs font-medium">{trainer.exp} exp</span>}
                <div className="flex gap-0.5">{[...Array(5)].map((_, i) => (<Star key={i} className="h-3 w-3 fill-orange-400 text-orange-400" />))}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="card-3d-back rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/20 to-red-600/10 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
          <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-orange-500/40 mb-4">
            <img src={trainer.img} alt={trainer.name} className="w-full h-full object-cover" />
          </div>
          <div className="text-white font-black text-xl mb-1">{trainer.name}</div>
          <div className="text-orange-400 text-sm font-semibold mb-4">{trainer.role}</div>
          <p className="text-white/70 text-sm leading-relaxed">{trainer.bio || 'Dedicated fitness professional committed to helping you reach your peak performance.'}</p>
          <div className="flex gap-0.5 mt-4">{[...Array(5)].map((_, i) => (<Star key={i} className="h-4 w-4 fill-orange-400 text-orange-400" />))}</div>
        </div>
      </div>
    </motion.div>
  );
}

function PricingCard({ plan, idx, isPopular, onCta }: { plan: any; idx: number; isPopular: boolean; onCta: () => void }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rx = ((e.clientY - cy) / (rect.height / 2)) * 5;
    const ry = ((e.clientX - cx) / (rect.width / 2)) * -5;
    setTilt({ x: rx, y: ry });
  };
  const handleMouseEnter = () => setHovered(true);
  const handleMouseLeave = () => { setHovered(false); setTilt({ x: 0, y: 0 }); };

  const floatClassMap = ['animate-price-float-1', 'animate-price-float-2', 'animate-price-float-3'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: idx * 0.1 }}
      data-testid={`card-plan-${idx}`}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`relative rounded-3xl border transition-shadow duration-300 ${hovered ? '' : floatClassMap[idx % 3]} ${isPopular ? 'bg-gradient-to-b from-orange-500/20 to-red-600/10 border-orange-500/40 shadow-2xl shadow-orange-500/20' : 'bg-white/[0.03] border-white/[0.08]'}`}
        style={{
          transform: hovered
            ? `perspective(800px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateZ(${isPopular ? '60px' : '20px'}) scale(1.02)`
            : isPopular
            ? 'translateZ(40px) scale(1.04)'
            : 'none',
          transition: 'transform 0.3s ease-out, box-shadow 0.3s ease-out',
          zIndex: isPopular ? 10 : 1,
        }}
      >
        <div className="p-7">
          {isPopular && <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-orange-500 to-red-600 text-white text-xs font-bold shadow-lg shadow-orange-500/30">MOST POPULAR</div>}
          <div className="mb-6">
            <h3 className="text-xl font-bold text-white mb-1">{plan.name}</h3>
            <div className="text-white/50 text-sm">{plan.duration}</div>
          </div>
          <div className="mb-7">
            <div className="flex items-end gap-2">
              <span className="text-5xl font-black text-white">₹{plan.price.toLocaleString()}</span>
              <span className="text-white/40 text-sm mb-2">/{plan.duration?.split(' ')[0] === '1' ? 'mo' : plan.duration?.includes('3') ? '3mo' : 'yr'}</span>
            </div>
          </div>
          <ul className="space-y-3 mb-8">
            {(plan.features || []).map((f: string) => (
              <li key={f} className="flex items-center gap-3 text-sm text-white/70"><Check className="h-4 w-4 text-orange-400 shrink-0" />{f}</li>
            ))}
          </ul>
          <button
            data-testid={`button-get-plan-${idx}`}
            onClick={onCta}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all ${isPopular ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40' : 'bg-white/[0.06] text-white hover:bg-white/10 border border-white/10'}`}
          >
            Get Started <ArrowRight className="inline h-4 w-4 ml-1" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function RevealSection({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
function WhatsAppFAB() {
  const { data: phoneNumber } = useQuery({
    queryKey: ['whatsapp-business-phone'],
    queryFn: async () => {
      // Try integration_settings first for WhatsApp config
      const { data } = await supabase
        .from('integration_settings')
        .select('config')
        .eq('integration_type', 'whatsapp')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      const phone = (data?.config as any)?.business_phone_number || (data?.config as any)?.phone_number;
      if (phone) return phone.replace(/[^0-9]/g, '');
      // Fallback to branches table phone
      const { data: branch } = await supabase
        .from('branches')
        .select('phone')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();
      return branch?.phone?.replace(/[^0-9+]/g, '').replace('+', '') || null;
    },
    staleTime: 600000,
  });

  if (!phoneNumber) return null;

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=Hi%20Incline%20Gym%2C%20I%20would%20like%20to%20know%20more!`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-emerald-500/30 flex items-center justify-center hover:scale-110 transition-transform animate-pulse hover:animate-none"
      aria-label="Chat on WhatsApp"
    >
      <MessageCircle className="h-7 w-7" />
    </a>
  );
}

export default function PublicWebsite() {
  const [theme, setTheme] = useState<ThemeSettings>(cmsService.getDefaultTheme());
  const [mousePosition, setMousePosition] = useState({ x: 0.5, y: 0.5 });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [leadForm, setLeadForm] = useState({ fullName: '', phone: '', email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroTilt, setHeroTilt] = useState({ x: 0, y: 0 });

  const statsRef = useRef<HTMLDivElement>(null);
  const statsInView = useInView(statsRef, { once: true });

  const { data: dbTrainers = [] } = useQuery({
    queryKey: ['public-trainers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trainers')
        .select('id, specializations, bio, user_id, profiles:trainers_user_id_profiles_fkey(full_name, avatar_url)')
        .eq('is_active', true)
        .limit(8);
      if (error) return [];
      return (data || []).map((t: any) => ({
        name: t.profiles?.full_name || 'Trainer',
        role: t.specializations?.[0] || 'Fitness Expert',
        bio: t.bio || '',
        exp: '',
        img: t.profiles?.avatar_url || 'https://images.pexels.com/photos/1431282/pexels-photo-1431282.jpeg?auto=compress&cs=tinysrgb&w=400',
      }));
    },
    staleTime: 300000,
  });

  const { data: dbPlans = [] } = useQuery({
    queryKey: ['public-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('id, name, price, duration_days')
        .eq('is_active', true)
        .order('price', { ascending: true })
        .limit(4);
      if (error) return [];
      return (data || []).map((p: any) => {
        const months = Math.round((p.duration_days || 30) / 30);
        return {
          name: p.name,
          price: p.price,
          duration: months === 1 ? '1 Month' : months === 3 ? '3 Months' : `${months} Months`,
          features: [],
          isPopular: false,
        };
      });
    },
    staleTime: 300000,
  });

  const { data: dbClasses = [] } = useQuery({
    queryKey: ['public-classes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, scheduled_at, duration_minutes, capacity, class_type')
        .eq('is_active', true)
        .gte('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(6);
      if (error) return [];
      return (data || []).map((c: any, i: number) => ({
        name: c.name,
        time: format(new Date(c.scheduled_at), 'h:mm a'),
        duration: `${c.duration_minutes || 45} min`,
        icon: getClassIcon(c.name),
        color: CLASS_COLOR_MAP[i % CLASS_COLOR_MAP.length],
        spots: Math.max(1, c.capacity - Math.floor(Math.random() * c.capacity * 0.7)),
      }));
    },
    staleTime: 300000,
  });

  const { data: dbStats } = useQuery({
    queryKey: ['public-stats'],
    queryFn: async () => {
      const [membersRes, trainersRes, branchesRes] = await Promise.all([
        supabase.from('members').select('id', { count: 'exact', head: true }),
        supabase.from('trainers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      return {
        members: membersRes.count || 0,
        trainers: trainersRes.count || 0,
        branches: branchesRes.count || 0,
      };
    },
    staleTime: 300000,
  });

  const trainers = dbTrainers.length > 0 ? dbTrainers : FALLBACK_TRAINERS;
  const pricingPlans = dbPlans.length > 0 ? dbPlans : theme.pricingPlans;
  const classes = dbClasses.length > 0 ? dbClasses : FALLBACK_CLASSES;
  const stats = [
    { value: dbStats?.members ? `${dbStats.members.toLocaleString()}+` : '2,500+', label: 'Active Members', icon: Users },
    { value: '98%', label: 'Satisfaction Rate', icon: Heart },
    { value: dbStats?.trainers ? `${dbStats.trainers}+` : '25+', label: 'Expert Trainers', icon: Trophy },
    { value: dbStats?.branches ? `${dbStats.branches}+` : '15+', label: 'Branches', icon: MapPin },
  ];

  useEffect(() => {
    setTheme(cmsService.getTheme());
    cmsService.getThemeAsync().then(dbTheme => setTheme(dbTheme)).catch(() => {});
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!heroRef.current) return;
      const rect = heroRef.current.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      setMousePosition({ x: nx, y: ny });
      setHeroTilt({
        x: (ny - 0.5) * 16,
        y: (nx - 0.5) * -16,
      });
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const handleLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.fullName.trim() || !leadForm.phone.trim()) { toast.error('Please enter your name and phone number'); return; }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('capture-lead', {
        body: { fullName: leadForm.fullName.trim(), phone: leadForm.phone.trim(), email: leadForm.email.trim() || undefined, source: 'website' },
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success('Thank you! We will contact you soon.');
      setLeadForm({ fullName: '', phone: '', email: '' });
    } catch { toast.error('Failed to submit. Please try again.'); }
    finally { setIsSubmitting(false); }
  };

  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    setMobileMenuOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white overflow-x-hidden font-sans">

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'bg-[#0a0a0f]/90 backdrop-blur-2xl border-b border-white/[0.06] shadow-2xl shadow-black/50' : 'bg-transparent backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
              <Dumbbell className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">{theme.gymName}</span>
          </div>
          <div className="hidden lg:flex items-center gap-8">
            {['Features', 'Classes', 'Trainers', 'Pricing', 'Reviews', 'Contact'].map((label) => (
              <button key={label} data-testid={`nav-${label.toLowerCase()}`} onClick={() => scrollTo(label.toLowerCase() === 'reviews' ? 'testimonials' : label.toLowerCase())} className="text-sm text-white/70 hover:text-white transition-colors">{label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden sm:block"><Button variant="outline" size="sm" className="border-white/20 text-white hover:bg-white/10 hover:border-white/40 bg-white/5">Sign In</Button></Link>
            <button data-testid="button-free-trial-nav" onClick={() => scrollTo('contact')} className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-sm font-semibold text-white shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transition-all">
              Free Trial <ArrowRight className="h-4 w-4" />
            </button>
            <button data-testid="button-mobile-menu" className="lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        <div className={`lg:hidden transition-all duration-300 overflow-hidden ${mobileMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
          <div className="px-4 pb-4 pt-2 bg-[#0a0a0f]/98 backdrop-blur-2xl border-b border-white/[0.06] flex flex-col gap-1">
            {['Features', 'Classes', 'Trainers', 'Pricing', 'Reviews', 'Contact'].map((label) => (
              <button key={label} onClick={() => scrollTo(label.toLowerCase() === 'reviews' ? 'testimonials' : label.toLowerCase())} className="text-left py-3 px-4 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors text-sm font-medium">{label}</button>
            ))}
            <div className="flex gap-2 mt-2 pt-2 border-t border-white/10">
              <Link to="/auth" className="flex-1"><Button variant="outline" size="sm" className="w-full border-white/20 text-white hover:bg-white/10">Sign In</Button></Link>
              <button onClick={() => scrollTo('contact')} className="flex-1 py-2 px-4 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 text-sm font-semibold text-white">Free Trial</button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="hero" ref={heroRef} className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ background: '#0a0a0f' }}>
        <ParticleCanvas />

        {/* Floating gradient blobs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="animate-float-slow absolute w-[700px] h-[700px] rounded-full opacity-20"
            style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.35) 0%, transparent 70%)', left: '15%', top: '10%', transform: 'translate(-50%, -50%)', filter: 'blur(60px)' }} />
          <div className="animate-float-medium absolute w-[500px] h-[500px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, transparent 70%)', right: '10%', top: '20%', filter: 'blur(80px)' }} />
          <div className="animate-float-alt absolute w-[400px] h-[400px] rounded-full opacity-15"
            style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.35) 0%, transparent 70%)', left: '50%', bottom: '10%', filter: 'blur(70px)' }} />
          <div className="animate-float-fast absolute w-[300px] h-[300px] rounded-full opacity-10"
            style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.4) 0%, transparent 70%)', right: '30%', bottom: '30%', filter: 'blur(50px)' }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-8 animate-pulse"
              >
                <Flame className="h-4 w-4" /> Limited: 50% OFF First Month — 48 hrs left
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="text-6xl sm:text-7xl lg:text-8xl font-black leading-[0.92] tracking-tight mb-6"
              >
                <span className="text-white">{theme.heroTitle?.split(' ').slice(0, 2).join(' ') || 'FORGE YOUR'}</span><br />
                <span
                  className="text-transparent bg-clip-text animate-shimmer"
                  style={{ backgroundImage: 'linear-gradient(90deg, #f97316, #ef4444, #ec4899, #f97316)', backgroundSize: '200% 100%' }}
                >
                  {theme.heroTitle?.split(' ').slice(2).join(' ') || 'STRONGER'}
                </span><br />
                <span className="text-white/90">BODY IN 2026</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-lg sm:text-xl text-white/60 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed"
              >
                {theme.heroSubtitle || "India's most advanced gym — world-class facilities meet cutting-edge tech."}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-10"
              >
                <button data-testid="button-start-trial-hero" onClick={() => scrollTo('contact')} className="group flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-lg shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/60 hover:scale-105 active:scale-100 transition-all">
                  Start Free Trial <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button data-testid="button-watch-tour" onClick={() => setVideoPlaying(true)} className="group flex items-center justify-center gap-3 px-8 py-4 rounded-2xl border border-white/20 text-white font-semibold text-lg hover:bg-white/5 hover:border-white/40 transition-all">
                  <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors"><Play className="h-4 w-4 ml-0.5" /></div>
                  Watch Tour
                </button>
              </motion.div>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.7 }}
                className="flex flex-wrap items-center gap-6 justify-center lg:justify-start text-sm text-white/40"
              >
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-400" /> No credit card</span>
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-400" /> Cancel anytime</span>
                <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-green-400" /> Free 3-day pass</span>
              </motion.div>
            </div>

            {/* 3D hero card with mouse tilt — max ±8° each axis */}
            <div className="relative hidden lg:flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                style={{
                  transform: `perspective(800px) rotateX(${heroTilt.x}deg) rotateY(${heroTilt.y}deg)`,
                  transition: 'transform 0.3s ease-out',
                }}
                className="relative w-full max-w-sm"
              >
                <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-black/60 border border-white/10">
                  <img src="https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600" alt="Gym training" className="w-full h-80 object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-center justify-between">
                      <div><div className="text-xs text-white/60 mb-1">Today's Highlight</div><div className="text-white font-bold">HIIT Blast — 6:00 AM</div></div>
                      <div className="h-12 w-12 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg"><Flame className="h-6 w-6 text-white" /></div>
                    </div>
                  </div>
                </div>

                {/* Floating stat pills — staggered bob animations at different z-levels via shadow depth */}
                <div className="animate-bob-1 absolute -top-6 -right-8 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20" style={{ boxShadow: '0 30px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)', zIndex: 4 }}>
                  <div className="text-2xl font-black text-orange-400">{stats[0].value}</div>
                  <div className="text-xs text-white/60">Active Members</div>
                </div>
                <div className="animate-bob-2 absolute -bottom-6 -left-8 px-4 py-3 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20" style={{ boxShadow: '0 20px 40px rgba(0,0,0,0.5)', zIndex: 3 }}>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">{[1, 2, 3].map((i) => (<div key={i} className="h-7 w-7 rounded-full bg-gradient-to-br from-orange-400 to-red-500 border-2 border-[#0a0a0f]" />))}</div>
                    <div><div className="text-xs font-bold text-white">42 checking in</div><div className="text-xs text-white/50">right now</div></div>
                  </div>
                </div>
                <div className="animate-bob-3 absolute top-1/2 -left-10 -translate-y-1/2 px-3 py-2 rounded-xl bg-green-500/20 backdrop-blur-xl border border-green-500/30" style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.7), 0 8px 16px rgba(16,185,129,0.15)', zIndex: 5 }}>
                  <div className="flex items-center gap-2"><div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" /><span className="text-xs font-semibold text-green-400">LIVE</span></div>
                </div>
                <div className="animate-bob-4 absolute top-4 left-0 px-3 py-2 rounded-xl bg-violet-500/20 backdrop-blur-xl border border-violet-500/30" style={{ boxShadow: '0 10px 20px rgba(0,0,0,0.4)', zIndex: 2 }}>
                  <div className="text-xs font-semibold text-violet-300">⭐ 4.9 Rating</div>
                </div>
              </motion.div>
            </div>
          </div>

          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30 text-xs">
            <span>Scroll to explore</span><ChevronDown className="h-5 w-5 animate-bounce" />
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF BANNER */}
      <div className="relative py-5 bg-gradient-to-r from-orange-500/10 via-red-500/10 to-orange-500/10 border-y border-orange-500/20 overflow-hidden noise-overlay">
        <div className="flex items-center gap-12 animate-marquee whitespace-nowrap">
          {[...Array(3)].map((_, gi) => (
            <div key={gi} className="flex items-center gap-12 shrink-0">
              {['GOOGLE 4.9★', '10,000+ TRANSFORMATIONS', 'VOTED BEST GYM 2025', 'ISO CERTIFIED', 'TRAINED ATHLETES', '24/7 SUPPORT'].map((text) => (
                <span key={text} className="text-sm font-bold text-orange-400/70 tracking-widest uppercase flex items-center gap-3"><Sparkles className="h-4 w-4 shrink-0" />{text}</span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* STATS */}
      <section
        ref={statsRef}
        className="relative py-20 overflow-hidden"
        style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(249,115,22,0.08) 0%, transparent 60%), #0a0a0f' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map(({ value, label, icon: Icon }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 30 }}
                animate={statsInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
                whileHover={{ scale: 1.04, y: -4 }}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-center group hover:border-orange-500/30 hover:bg-white/[0.05] transition-colors duration-300 cursor-default"
              >
                <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-orange-500/20 transition-colors"><Icon className="h-6 w-6 text-orange-400" /></div>
                <div className="text-4xl font-black text-white mb-1">{value}</div>
                <div className="text-sm text-white/50">{label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative py-24 overflow-hidden noise-overlay" style={{ background: 'radial-gradient(ellipse at 30% 50%, rgba(99,102,241,0.12) 0%, transparent 60%), #0c0c14' }}>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <RevealSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6"><Zap className="h-4 w-4" /> Everything You Need</span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Built for Champions</h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">World-class facilities combined with cutting-edge technology to accelerate your results.</p>
          </RevealSection>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES_ADVANCED.map((feat, i) => (
              <FeatureCard3D key={feat.title} {...feat} index={i} />
            ))}
          </div>
          <RevealSection className="mt-12 grid lg:grid-cols-2 gap-8 items-center p-8 rounded-3xl bg-gradient-to-br from-orange-500/10 to-red-600/5 border border-orange-500/20">
            <div>
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 mb-4">AI Powered</Badge>
              <h3 className="text-3xl font-black text-white mb-4">Your Personal AI Fitness Coach</h3>
              <p className="text-white/60 mb-6 leading-relaxed">Our AI analyzes your performance data, sleep patterns, and nutrition to deliver hyper-personalized workout recommendations.</p>
              <ul className="space-y-3">
                {['Adaptive workout plans that evolve with you', 'Real-time form correction via camera', 'Nutrition timing and meal suggestions', 'Recovery optimization & injury prevention'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-white/70"><Check className="h-4 w-4 text-orange-400 shrink-0" />{item}</li>
                ))}
              </ul>
            </div>
            <div className="relative">
              <img src="https://images.pexels.com/photos/3823488/pexels-photo-3823488.jpeg?auto=compress&cs=tinysrgb&w=600" alt="AI fitness coaching" className="w-full rounded-2xl object-cover h-72" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-[#0a0a0f]/60 to-transparent" />
            </div>
          </RevealSection>
        </div>
      </section>

      {/* CLASSES */}
      <section id="classes" className="relative py-24 overflow-hidden" style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(249,115,22,0.08) 0%, transparent 60%), #0a0a0f' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <RevealSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6"><Calendar className="h-4 w-4" /> Today's Schedule</span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">50+ Weekly Classes</h2>
            <p className="text-lg text-white/50">From high-intensity to mindful movement — find your perfect class.</p>
          </RevealSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {classes.map((cls: any, idx: number) => {
              const Icon = cls.icon || Activity;
              return (
                <motion.div
                  key={cls.name}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: idx * 0.05 }}
                  data-testid={`card-class-${idx}`}
                  whileHover={{ scale: 1.02 }}
                  className="group p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/20 hover:bg-white/[0.05] transition-colors duration-300 cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${cls.color} flex items-center justify-center shadow-lg`}><Icon className="h-6 w-6 text-white" /></div>
                    <div className={`px-2 py-1 rounded-lg text-xs font-semibold ${cls.spots <= 3 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>{cls.spots <= 3 ? `${cls.spots} spots left!` : `${cls.spots} open`}</div>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1">{cls.name}</h3>
                  <div className="flex items-center gap-4 text-sm text-white/50">
                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{cls.time}</span>
                    <span>{cls.duration}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
          <RevealSection className="text-center mt-8">
            <button data-testid="button-view-schedule" onClick={() => scrollTo('contact')} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/20 text-white font-semibold text-sm hover:bg-white/5 transition-all">View Full Schedule <ChevronRight className="h-4 w-4" /></button>
          </RevealSection>
        </div>
      </section>

      {/* TRAINERS */}
      <section id="trainers" className="relative py-24 overflow-hidden noise-overlay" style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(139,92,246,0.1) 0%, transparent 60%), #0c0c14' }}>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <RevealSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6"><Trophy className="h-4 w-4" /> Expert Team</span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">World-Class Trainers</h2>
            <p className="text-lg text-white/50 max-w-2xl mx-auto">Hover to learn more. Certified experts dedicated to your transformation.</p>
          </RevealSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {trainers.slice(0, 4).map((trainer: any, idx: number) => (
              <TrainerFlipCard key={`trainer-${idx}-${trainer.name}`} trainer={trainer} idx={idx} />
            ))}
          </div>
        </div>
      </section>

      {/* 3D BODY SCANNER USP */}
      <section id="scanner" className="relative py-24 overflow-hidden noise-overlay" style={{ background: 'radial-gradient(ellipse at 70% 30%, rgba(249,115,22,0.12) 0%, transparent 60%), #0a0a0f' }}>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <RevealSection>
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" /> Industry First in Udaipur
              </span>
              <h2 className="text-4xl sm:text-5xl font-black text-white mb-4 leading-tight">
                3D Body Intelligence.<br />
                <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">See Yourself in Real Time.</span>
              </h2>
              <p className="text-lg text-white/60 mb-8 leading-relaxed">
                Step on. Stand still. Get scanned. Our HOWBODY 3D scanner captures your posture,
                body composition, and silhouette in a true three-dimensional model — every transformation
                tracked, every millimetre measured. Only at Incline.
              </p>
              <div className="grid sm:grid-cols-2 gap-4 mb-8">
                {[
                  { icon: BarChart3, label: 'Body composition', desc: 'Fat, muscle, water — precise to the gram.' },
                  { icon: Activity, label: 'Posture analysis', desc: 'Spinal alignment & imbalance detection.' },
                  { icon: TrendingUp, label: 'Progress timeline', desc: 'Side-by-side 3D snapshots over months.' },
                  { icon: Shield, label: 'Private & secure', desc: 'Your scans, your data — encrypted.' },
                ].map((f, i) => (
                  <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <div className="shrink-0 p-2 rounded-xl bg-orange-500/10 text-orange-400">
                      <f.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{f.label}</p>
                      <p className="text-white/50 text-xs mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                size="lg"
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-2xl px-8"
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                Book Your First Scan <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </RevealSection>
            <RevealSection>
              <Suspense fallback={
                <div className="w-full h-[420px] sm:h-[520px] rounded-3xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
                </div>
              }>
                <ScannerHero3D />
              </Suspense>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section className="py-8 overflow-hidden">
        <div className="flex gap-4 overflow-hidden">
          {['https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600', 'https://images.pexels.com/photos/3823488/pexels-photo-3823488.jpeg?auto=compress&cs=tinysrgb&w=600', 'https://images.pexels.com/photos/1431282/pexels-photo-1431282.jpeg?auto=compress&cs=tinysrgb&w=600', 'https://images.pexels.com/photos/3076509/pexels-photo-3076509.jpeg?auto=compress&cs=tinysrgb&w=600', 'https://images.pexels.com/photos/6975489/pexels-photo-6975489.jpeg?auto=compress&cs=tinysrgb&w=600', 'https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=600'].map((url, i) => (
            <div key={i} className="shrink-0 w-72 h-48 rounded-2xl overflow-hidden border border-white/10">
              <img src={url} alt={`Facility ${i + 1}`} className="w-full h-full object-cover hover:scale-110 transition-transform duration-500" />
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="relative py-24 overflow-hidden noise-overlay" style={{ background: 'radial-gradient(ellipse at 60% 40%, rgba(249,115,22,0.1) 0%, transparent 55%), #0c0c14' }}>
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
          <RevealSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6"><Target className="h-4 w-4" /> Membership Plans</span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Simple, Transparent Pricing</h2>
            <p className="text-lg text-white/50">No hidden fees. Cancel anytime.</p>
          </RevealSection>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto" style={{ perspective: '1200px' }}>
            {pricingPlans.map((plan: any, idx: number) => {
              const isPopular = plan.isPopular || (pricingPlans.length > 1 && idx === Math.floor(pricingPlans.length / 2));
              return (
                <PricingCard
                  key={plan.id || `plan-${idx}`}
                  plan={plan}
                  idx={idx}
                  isPopular={isPopular}
                  onCta={() => scrollTo('contact')}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section id="testimonials" className="relative py-24 overflow-hidden" style={{ background: 'radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.08) 0%, transparent 55%), #0a0a0f' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <RevealSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6"><Star className="h-4 w-4" /> Testimonials</span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Loved by Members</h2>
          </RevealSection>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {theme.testimonials.slice(0, 6).map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                data-testid={`card-testimonial-${i}`}
                whileHover={{ scale: 1.02 }}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-white/20 transition-colors duration-300 group backdrop-blur-sm"
              >
                <Quote className="h-8 w-8 text-orange-500/30 mb-4" />
                <p className="text-white/80 text-sm leading-relaxed mb-6 italic">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-sm shrink-0">{t.name.charAt(0)}</div>
                  <div>
                    <div className="font-bold text-white text-sm">{t.name}</div>
                    <div className="flex gap-0.5 mt-1">{[...Array(5)].map((_, j) => (<Star key={j} className="h-3 w-3 fill-orange-400 text-orange-400" />))}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="relative py-24 overflow-hidden noise-overlay" style={{ background: 'radial-gradient(ellipse at 30% 70%, rgba(249,115,22,0.06) 0%, transparent 55%), #0c0c14' }}>
        <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6">
          <RevealSection className="text-center mb-16">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-medium mb-6"><MessageCircle className="h-4 w-4" /> FAQ</span>
            <h2 className="text-4xl sm:text-5xl font-black text-white mb-4">Got Questions?</h2>
          </RevealSection>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                data-testid={`faq-item-${i}`}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${openFaq === i ? 'border-orange-500/30 bg-orange-500/5' : 'border-white/[0.06] bg-white/[0.02]'}`}
              >
                <button data-testid={`button-faq-${i}`} className="w-full text-left px-6 py-5 flex items-center justify-between gap-4" onClick={() => setOpenFaq(openFaq === i ? null : i)} aria-expanded={openFaq === i}>
                  <span className="font-semibold text-white text-sm sm:text-base">{faq.q}</span>
                  <ChevronDown className={`h-5 w-5 text-orange-400 shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                <div className={`transition-all duration-300 ${openFaq === i ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                  <p className="px-6 pb-5 text-sm text-white/60 leading-relaxed">{faq.a}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="relative py-24 overflow-hidden" style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.12) 0%, transparent 60%), #0a0a0f' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <RevealSection>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500/20 via-red-600/15 to-transparent border border-orange-500/20 p-10 sm:p-14 mb-16 text-center">
              <div className="absolute inset-0 pointer-events-none"><div className="absolute top-0 left-1/4 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" /><div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl" /></div>
              <div className="relative">
                <h2 className="text-4xl sm:text-6xl font-black text-white mb-4">Your Transformation<br /><span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #f97316, #ef4444)' }}>Starts Today</span></h2>
                <p className="text-white/60 text-lg max-w-xl mx-auto mb-8">Join {stats[0].value} members who transformed their lives. First 3 days are on us.</p>
                <button data-testid="button-claim-trial-cta" onClick={() => document.getElementById('lead-form')?.scrollIntoView({ behavior: 'smooth' })} className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-black text-xl shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 transition-all">
                  Claim Free 3-Day Pass <ArrowRight className="h-6 w-6" />
                </button>
              </div>
            </div>
          </RevealSection>
          <div className="grid lg:grid-cols-2 gap-12">
            <RevealSection>
              <h3 className="text-2xl font-black text-white mb-8">Find Us</h3>
              <div className="space-y-5">
                {[
                  { icon: MapPin, label: 'Address', value: theme.address, color: 'text-orange-400' },
                  { icon: Phone, label: 'Phone', value: theme.contactPhone, color: 'text-green-400' },
                  { icon: Mail, label: 'Email', value: theme.contactEmail, color: 'text-blue-400' },
                  { icon: Clock, label: 'Hours', value: 'Mon–Fri: 5:30 AM–11 PM | Sat–Sun: 6 AM–9 PM', color: 'text-amber-400' },
                ].map(({ icon: Icon, label, value, color }) => (
                  <div key={label} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.05]">
                    <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0"><Icon className={`h-5 w-5 ${color}`} /></div>
                    <div><div className="text-xs text-white/40 mb-1">{label}</div><div className="text-white text-sm font-medium">{value}</div></div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-8">
                {[
                  { icon: Instagram, href: theme.socialLinks.instagram, label: 'Instagram' },
                  { icon: Facebook, href: theme.socialLinks.facebook, label: 'Facebook' },
                  { icon: Twitter, href: theme.socialLinks.twitter, label: 'Twitter' },
                  { icon: Youtube, href: theme.socialLinks.youtube, label: 'YouTube' },
                ].filter(s => s.href).map(({ icon: Icon, href, label }) => (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className="h-11 w-11 rounded-xl bg-white/[0.05] hover:bg-orange-500/20 border border-white/[0.06] hover:border-orange-500/30 flex items-center justify-center transition-all group">
                    <Icon className="h-5 w-5 text-white/60 group-hover:text-white transition-colors" />
                  </a>
                ))}
              </div>
            </RevealSection>
            <RevealSection>
              <div id="lead-form">
                <div className="p-8 rounded-3xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
                  <h3 className="text-2xl font-black text-white mb-2">Start Your Free Trial</h3>
                  <p className="text-white/50 text-sm mb-6">3-day complimentary pass. No credit card required.</p>
                  {submitted ? (
                    <div className="text-center py-10">
                      <div className="h-20 w-20 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mx-auto mb-6"><Check className="h-10 w-10 text-green-400" /></div>
                      <h4 className="text-2xl font-black text-white mb-2">You're In!</h4>
                      <p className="text-white/50 text-sm">We'll call you within 2 hours to schedule your free trial session.</p>
                    </div>
                  ) : (
                    <form className="space-y-4" onSubmit={handleLeadSubmit} noValidate>
                      <div><label htmlFor="fullName" className="block text-xs font-medium text-white/50 mb-1.5">Full Name *</label><input data-testid="input-fullname" id="fullName" type="text" placeholder="Rahul Sharma" value={leadForm.fullName} onChange={(e) => setLeadForm(prev => ({ ...prev, fullName: e.target.value }))} className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/25 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-sm" required autoComplete="name" /></div>
                      <div><label htmlFor="phone" className="block text-xs font-medium text-white/50 mb-1.5">Phone Number *</label><input data-testid="input-phone" id="phone" type="tel" placeholder="+91 98765 43210" value={leadForm.phone} onChange={(e) => setLeadForm(prev => ({ ...prev, phone: e.target.value }))} className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/25 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-sm" required autoComplete="tel" /></div>
                      <div><label htmlFor="email" className="block text-xs font-medium text-white/50 mb-1.5">Email <span className="text-white/25">(optional)</span></label><input data-testid="input-email" id="email" type="email" placeholder="rahul@example.com" value={leadForm.email} onChange={(e) => setLeadForm(prev => ({ ...prev, email: e.target.value }))} className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white placeholder:text-white/25 focus:border-orange-500/60 focus:outline-none focus:ring-2 focus:ring-orange-500/20 transition-all text-sm" autoComplete="email" /></div>
                      <button data-testid="button-submit-trial" type="submit" disabled={isSubmitting} className="w-full py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-600 text-white font-bold text-base shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40 hover:scale-[1.02] active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed transition-all">
                        {isSubmitting ? <span className="flex items-center justify-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Submitting...</span> : <span className="flex items-center justify-center gap-2">Claim Free Trial Pass <ArrowRight className="h-5 w-5" /></span>}
                      </button>
                      <p className="text-center text-xs text-white/25">
                        By submitting, you agree to our{' '}
                        <Link to="/privacy-policy" className="text-orange-400 hover:text-orange-300 transition-colors">
                          Privacy Policy
                        </Link>
                        .
                      </p>
                    </form>
                  )}
                </div>
              </div>
            </RevealSection>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-[#050508] border-t border-white/[0.05]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center"><Dumbbell className="h-5 w-5 text-white" /></div>
                <span className="font-black text-white">{theme.gymName}</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed mb-4">{theme.gymTagline}</p>
              <div className="flex gap-2">
                {[{ icon: Instagram, href: theme.socialLinks.instagram }, { icon: Facebook, href: theme.socialLinks.facebook }, { icon: Twitter, href: theme.socialLinks.twitter }, { icon: Youtube, href: theme.socialLinks.youtube }].filter(s => s.href).map(({ icon: Icon, href }, i) => (
                  <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="h-8 w-8 rounded-lg bg-white/[0.05] hover:bg-white/10 flex items-center justify-center transition-colors"><Icon className="h-4 w-4 text-white/40 hover:text-white transition-colors" /></a>
                ))}
              </div>
            </div>
            {[
              { title: 'Company', links: [{ label: 'About Us', href: '#' }, { label: 'Careers', href: '#' }, { label: 'Blog', href: '#' }, { label: 'Press', href: '#' }] },
              { title: 'Members', links: [{ label: 'Sign In', href: '/auth' }, { label: 'Free Trial', href: '#contact' }, { label: 'Plans', href: '#pricing' }, { label: 'Classes', href: '#classes' }] },
              { title: 'Support', links: [{ label: 'FAQ', href: '#' }, { label: 'Contact', href: '#contact' }, { label: 'Privacy Policy', href: '/privacy-policy' }, { label: 'Terms of Service', href: '/terms-of-service' }, { label: 'Data Deletion', href: '/data-deletion' }] },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="font-bold text-white text-sm mb-4">{title}</h4>
                <ul className="space-y-2.5">
                  {links.map(({ label, href }) => (
                    <li key={label}>
                      {href.startsWith('/') ? <Link to={href} className="text-white/40 hover:text-white text-sm transition-colors">{label}</Link>
                       : href.startsWith('#') ? <button onClick={() => scrollTo(href.slice(1))} className="text-white/40 hover:text-white text-sm transition-colors text-left">{label}</button>
                       : <a href={href} className="text-white/40 hover:text-white text-sm transition-colors">{label}</a>}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="pt-8 border-t border-white/[0.05] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/25 text-xs">© {new Date().getFullYear()} {theme.gymName}. All rights reserved.</p>
            <div className="flex items-center gap-2 text-white/25 text-xs">
              <span>Made with</span><Heart className="h-3 w-3 text-red-500" /><span>in India</span><span className="mx-2">·</span><Link to="/auth" className="hover:text-white transition-colors">Admin Login</Link>
            </div>
          </div>
        </div>
      </footer>

      {/* VIDEO MODAL */}
      {videoPlaying && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setVideoPlaying(false)}
        >
          <button className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors" onClick={() => setVideoPlaying(false)} aria-label="Close"><X className="h-5 w-5 text-white" /></button>
          <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl border border-white/10" onClick={e => e.stopPropagation()}>
            <img src="https://images.pexels.com/photos/1552242/pexels-photo-1552242.jpeg?auto=compress&cs=tinysrgb&w=1200" alt="Gym tour" className="w-full h-auto" />
            <div className="bg-[#111] px-6 py-4 text-white/60 text-sm text-center">Full gym tour video coming soon! Contact us for a live walkthrough.</div>
          </div>
        </motion.div>
      )}

      {/* WhatsApp FAB */}
      <WhatsAppFAB />

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
        .animate-marquee { animation: marquee 30s linear infinite; }
      `}</style>
    </div>
  );
}
