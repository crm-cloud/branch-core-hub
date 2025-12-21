// CMS Service for managing website content and theme
// This uses localStorage for now, can be migrated to Supabase later

export interface ThemeSettings {
  primaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  fontFamily: string;
  heroTitle: string;
  heroSubtitle: string;
  heroImage: string;
  logoUrl: string;
  gymName: string;
  gymTagline: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  socialLinks: {
    instagram?: string;
    facebook?: string;
    twitter?: string;
    youtube?: string;
  };
  features: Array<{
    title: string;
    description: string;
    icon: string;
  }>;
  testimonials: Array<{
    name: string;
    quote: string;
    image?: string;
  }>;
  pricingPlans: Array<{
    name: string;
    price: number;
    duration: string;
    features: string[];
    isPopular?: boolean;
  }>;
}

const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#1e293b',
  accentColor: '#f97316',
  backgroundColor: '#0f172a',
  textColor: '#f8fafc',
  fontFamily: 'Inter',
  heroTitle: 'TRANSFORM YOUR BODY',
  heroSubtitle: 'Incline Fitness - Where Champions Are Made',
  heroImage: '/gym-hero.jpg',
  logoUrl: '/logo.png',
  gymName: 'Incline Fitness',
  gymTagline: 'Elevate Your Potential',
  contactEmail: 'info@inclinefitness.com',
  contactPhone: '+91 98765 43210',
  address: '123 Fitness Street, Mumbai, India',
  socialLinks: {
    instagram: 'https://instagram.com/inclinefitness',
    facebook: 'https://facebook.com/inclinefitness',
    twitter: 'https://twitter.com/inclinefitness',
    youtube: 'https://youtube.com/inclinefitness',
  },
  features: [
    {
      title: 'Premium Equipment',
      description: 'State-of-the-art fitness machines and free weights',
      icon: 'dumbbell',
    },
    {
      title: 'Expert Trainers',
      description: 'Certified personal trainers to guide your journey',
      icon: 'users',
    },
    {
      title: 'Group Classes',
      description: 'Yoga, HIIT, Zumba, and more group sessions',
      icon: 'activity',
    },
    {
      title: '24/7 Access',
      description: 'Train anytime with round-the-clock gym access',
      icon: 'clock',
    },
  ],
  testimonials: [
    {
      name: 'Rahul S.',
      quote: 'Lost 20kg in 6 months. The trainers here are incredibly supportive!',
    },
    {
      name: 'Priya M.',
      quote: 'Best gym in the city. Clean, well-equipped, and great community.',
    },
    {
      name: 'Amit K.',
      quote: 'The personal training program completely transformed my fitness journey.',
    },
  ],
  pricingPlans: [
    {
      name: 'Monthly',
      price: 2999,
      duration: '1 Month',
      features: ['Full gym access', 'Locker facility', 'Basic fitness assessment'],
    },
    {
      name: 'Quarterly',
      price: 7999,
      duration: '3 Months',
      features: ['Full gym access', 'Locker facility', 'Fitness assessment', '2 PT sessions'],
      isPopular: true,
    },
    {
      name: 'Annual',
      price: 24999,
      duration: '12 Months',
      features: ['Full gym access', 'Premium locker', 'Monthly assessment', '12 PT sessions', 'Diet consultation'],
    },
  ],
};

const STORAGE_KEY = 'incline_cms_theme';

export const cmsService = {
  getTheme(): ThemeSettings {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return { ...DEFAULT_THEME, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Error loading theme:', e);
    }
    return DEFAULT_THEME;
  },

  saveTheme(theme: Partial<ThemeSettings>) {
    try {
      const current = this.getTheme();
      const updated = { ...current, ...theme };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    } catch (e) {
      console.error('Error saving theme:', e);
      throw e;
    }
  },

  resetTheme() {
    localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_THEME;
  },

  getDefaultTheme(): ThemeSettings {
    return DEFAULT_THEME;
  },
};
