import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  ArrowRight
} from 'lucide-react';
import { cmsService, ThemeSettings } from '@/services/cmsService';

export default function PublicWebsite() {
  const [theme, setTheme] = useState<ThemeSettings>(cmsService.getDefaultTheme());
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTheme(cmsService.getTheme());
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
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const getIcon = (name: string) => {
    const icons: Record<string, any> = {
      dumbbell: Dumbbell,
      users: Users,
      activity: Activity,
      clock: Clock,
    };
    const Icon = icons[name] || Dumbbell;
    return <Icon className="h-8 w-8" />;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-black/50 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
              <Dumbbell className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold">{theme.gymName}</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm hover:text-orange-400 transition-colors">Features</a>
            <a href="#pricing" className="text-sm hover:text-orange-400 transition-colors">Pricing</a>
            <a href="#testimonials" className="text-sm hover:text-orange-400 transition-colors">Testimonials</a>
            <a href="#contact" className="text-sm hover:text-orange-400 transition-colors">Contact</a>
          </div>
          <Link to="/auth">
            <Button className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white border-0">
              Join Now
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section with 3D Effect */}
      <section 
        ref={heroRef}
        className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, #1a1a2e 0%, #0a0a0a 70%)',
        }}
      >
        {/* 3D Floating Elements */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: `translate(${mousePosition.x * 20 - 10}px, ${mousePosition.y * 20 - 10}px)`,
            transition: 'transform 0.1s ease-out',
          }}
        >
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />
        </div>

        {/* Animated Grid */}
        <div className="absolute inset-0 opacity-20">
          <div 
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)
              `,
              backgroundSize: '60px 60px',
              transform: `perspective(500px) rotateX(60deg) translateY(-50%)`,
              transformOrigin: 'center center',
            }}
          />
        </div>

        {/* 3D Dumbbell Illustration */}
        <div 
          className="absolute right-10 top-1/2 -translate-y-1/2 hidden lg:block"
          style={{
            transform: `translate(${-mousePosition.x * 40 + 20}px, ${-mousePosition.y * 40 + 20}px) rotateY(${mousePosition.x * 20 - 10}deg) rotateX(${-mousePosition.y * 20 + 10}deg)`,
            transition: 'transform 0.1s ease-out',
          }}
        >
          <div className="relative">
            <div className="w-64 h-64 rounded-3xl bg-gradient-to-br from-orange-500/30 to-red-600/30 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl shadow-orange-500/20">
              <Dumbbell className="h-32 w-32 text-orange-400" />
            </div>
            <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-600/30 backdrop-blur-xl border border-white/10 flex items-center justify-center">
              <Activity className="h-16 w-16 text-purple-400" />
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <Badge className="mb-6 bg-orange-500/10 text-orange-400 border-orange-500/30 px-4 py-2">
            🔥 Limited Time: 50% OFF First Month
          </Badge>
          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
              {theme.heroTitle}
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-8 max-w-2xl mx-auto">
            {theme.heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white text-lg px-8 py-6 rounded-xl shadow-lg shadow-orange-500/30">
                Start Your Journey
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 text-lg px-8 py-6 rounded-xl">
              Take a Tour
            </Button>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { value: '500+', label: 'Active Members' },
              { value: '15+', label: 'Expert Trainers' },
              { value: '24/7', label: 'Gym Access' },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-3xl font-bold text-orange-400">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronRight className="h-8 w-8 text-white/30 rotate-90" />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-b from-[#0a0a0a] to-[#111]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/30">
              Why Choose Us
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">World-Class Facilities</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">
              Experience fitness like never before with our premium equipment and expert guidance
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {theme.features.map((feature, index) => (
              <Card 
                key={feature.title}
                className="bg-white/5 border-white/10 hover:border-orange-500/50 transition-all duration-300 group hover:-translate-y-2"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="p-6">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    {getIcon(feature.icon)}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-[#111]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/30">
              Membership Plans
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-gray-400 text-lg">
              Choose the plan that fits your fitness journey
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {theme.pricingPlans.map((plan) => (
              <Card 
                key={plan.name}
                className={`relative bg-white/5 border-white/10 ${plan.isPopular ? 'border-orange-500 scale-105' : ''} transition-all hover:border-orange-500/50`}
              >
                {plan.isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0 px-4">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                  <p className="text-gray-400 mb-4">{plan.duration}</p>
                  <div className="mb-6">
                    <span className="text-5xl font-black text-white">₹{plan.price.toLocaleString()}</span>
                    <span className="text-gray-400">/{plan.duration.toLowerCase()}</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2 text-gray-300">
                        <Check className="h-5 w-5 text-orange-400" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth">
                    <Button 
                      className={`w-full ${plan.isPopular ? 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700' : 'bg-white/10 hover:bg-white/20'} text-white border-0`}
                    >
                      Get Started
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-24 bg-gradient-to-b from-[#111] to-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/30">
              Success Stories
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">What Our Members Say</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {theme.testimonials.map((testimonial) => (
              <Card key={testimonial.name} className="bg-white/5 border-white/10">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 fill-orange-400 text-orange-400" />
                    ))}
                  </div>
                  <p className="text-gray-300 mb-4 italic">"{testimonial.quote}"</p>
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold">
                      {testimonial.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-white">{testimonial.name}</div>
                      <div className="text-sm text-gray-400">Member</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <Badge className="mb-4 bg-orange-500/10 text-orange-400 border-orange-500/30">
                Get In Touch
              </Badge>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">Ready to Transform?</h2>
              <p className="text-gray-400 text-lg mb-8">
                Visit us today or reach out for a free consultation. Our team is here to help you achieve your fitness goals.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Address</div>
                    <div className="text-white">{theme.address}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Phone className="h-6 w-6 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Phone</div>
                    <div className="text-white">{theme.contactPhone}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-orange-400" />
                  </div>
                  <div>
                    <div className="text-sm text-gray-400">Email</div>
                    <div className="text-white">{theme.contactEmail}</div>
                  </div>
                </div>
              </div>

              {/* Social Links */}
              <div className="flex gap-4 mt-8">
                {theme.socialLinks.instagram && (
                  <a href={theme.socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="h-12 w-12 rounded-xl bg-white/5 hover:bg-orange-500/20 flex items-center justify-center transition-colors">
                    <Instagram className="h-6 w-6 text-white" />
                  </a>
                )}
                {theme.socialLinks.facebook && (
                  <a href={theme.socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="h-12 w-12 rounded-xl bg-white/5 hover:bg-orange-500/20 flex items-center justify-center transition-colors">
                    <Facebook className="h-6 w-6 text-white" />
                  </a>
                )}
                {theme.socialLinks.twitter && (
                  <a href={theme.socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="h-12 w-12 rounded-xl bg-white/5 hover:bg-orange-500/20 flex items-center justify-center transition-colors">
                    <Twitter className="h-6 w-6 text-white" />
                  </a>
                )}
                {theme.socialLinks.youtube && (
                  <a href={theme.socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="h-12 w-12 rounded-xl bg-white/5 hover:bg-orange-500/20 flex items-center justify-center transition-colors">
                    <Youtube className="h-6 w-6 text-white" />
                  </a>
                )}
              </div>
            </div>

            {/* CTA Card */}
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-600/20 rounded-3xl blur-3xl" />
              <Card className="relative bg-gradient-to-br from-white/10 to-white/5 border-white/10 backdrop-blur-xl">
                <CardContent className="p-8">
                  <h3 className="text-2xl font-bold text-white mb-4">Start Your Free Trial</h3>
                  <p className="text-gray-400 mb-6">
                    Experience our facilities with a complimentary 3-day pass. No commitment required.
                  </p>
                  <form className="space-y-4">
                    <input 
                      type="text" 
                      placeholder="Your Name" 
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
                    />
                    <input 
                      type="tel" 
                      placeholder="Phone Number" 
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
                    />
                    <input 
                      type="email" 
                      placeholder="Email Address" 
                      className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:border-orange-500 focus:outline-none"
                    />
                    <Button className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white py-6 rounded-xl text-lg">
                      Claim Free Trial
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-white/10 bg-[#050505]">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                <Dumbbell className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold">{theme.gymName}</span>
            </div>
            <p className="text-gray-500 text-sm">
              © {new Date().getFullYear()} {theme.gymName}. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm text-gray-400">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <Link to="/auth" className="hover:text-white transition-colors">Admin Login</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
