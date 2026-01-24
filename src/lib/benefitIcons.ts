import {
  Thermometer,
  Snowflake,
  Waves,
  Dumbbell,
  Users,
  Car,
  Gift,
  Droplets,
  Cloud,
  Heart,
  Bike,
  Sparkles,
  Box,
  PersonStanding,
  Timer,
  Flame,
  Mountain,
  LucideIcon
} from 'lucide-react';

// Dynamic icon mapping for benefit types
export const benefitIcons: Record<string, LucideIcon> = {
  // Sauna related
  sauna_access: Thermometer,
  sauna_session: Thermometer,
  sauna: Thermometer,
  
  // Ice/Cold related
  ice_bath: Snowflake,
  cold_plunge: Snowflake,
  cryotherapy: Snowflake,
  
  // Water/Pool related
  pool_access: Waves,
  swimming_pool: Waves,
  pool: Waves,
  
  // Steam related
  steam_access: Cloud,
  steam_room: Cloud,
  steam: Cloud,
  
  // Spa related
  spa_access: Heart,
  spa: Heart,
  massage: Heart,
  
  // Gym/Fitness
  gym_access: Dumbbell,
  gym: Dumbbell,
  weight_training: Dumbbell,
  functional_training: Mountain,
  crossfit_class: Flame,
  
  // Classes
  group_classes: Users,
  yoga_class: PersonStanding,
  classes: Users,
  
  // Cardio
  cardio_area: Bike,
  cardio: Bike,
  
  // PT/Training
  pt_sessions: Timer,
  personal_training: Timer,
  
  // Facilities
  parking: Car,
  locker: Box,
  locker_access: Box,
  towel: Droplets,
  towel_service: Droplets,
  
  // Other
  guest_pass: Gift,
  other: Sparkles,
};

/**
 * Get the icon component for a benefit type
 * @param type - The benefit type code (e.g., 'sauna_access', 'ice_bath')
 * @returns The Lucide icon component
 */
export function getBenefitIcon(type: string): LucideIcon {
  const normalizedType = type.toLowerCase().replace(/[\s-]+/g, '_');
  return benefitIcons[normalizedType] || Sparkles;
}

/**
 * Get the icon component with a fallback for unknown types
 * @param type - The benefit type code
 * @param fallback - Fallback icon if type not found
 * @returns The Lucide icon component
 */
export function getBenefitIconWithFallback(type: string, fallback: LucideIcon = Sparkles): LucideIcon {
  const normalizedType = type.toLowerCase().replace(/[\s-]+/g, '_');
  return benefitIcons[normalizedType] || fallback;
}
