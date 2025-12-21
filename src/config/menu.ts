import type { Database } from '@/integrations/supabase/types';
import {
  LayoutDashboard, Users, UserPlus, CreditCard, Calendar, Dumbbell, Package,
  Settings, ClipboardList, Megaphone, BarChart3, Wallet, Clock,
  Lock, Sparkles, ShoppingBag, ShoppingCart, Gift, FileText, Wrench, CheckSquare, 
  Briefcase, MessageSquare, Tags, Activity, UtensilsCrossed, Target, 
  Bell, Snowflake, UserCog, TrendingUp, Heart
} from 'lucide-react';

type AppRole = Database['public']['Enums']['app_role'];

export interface MenuItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
}

export interface MenuSection {
  title: string;
  items: MenuItem[];
}

// Member-specific menu
export const memberMenuConfig: MenuSection[] = [
  {
    title: 'My Account',
    items: [
      { label: 'Dashboard', href: '/member-dashboard', icon: LayoutDashboard, roles: ['member'] },
      { label: 'My Attendance', href: '/my-attendance', icon: Clock, roles: ['member'] },
      { label: 'My Progress', href: '/my-progress', icon: TrendingUp, roles: ['member'] },
    ],
  },
  {
    title: 'Fitness',
    items: [
      { label: 'Book Classes', href: '/my-classes', icon: Calendar, roles: ['member'] },
      { label: 'PT Sessions', href: '/my-pt-sessions', icon: Dumbbell, roles: ['member'] },
      { label: 'Workout Plan', href: '/my-workout', icon: Activity, roles: ['member'] },
      { label: 'Diet Plan', href: '/my-diet', icon: UtensilsCrossed, roles: ['member'] },
    ],
  },
  {
    title: 'Services',
    items: [
      { label: 'Store', href: '/member-store', icon: ShoppingBag, roles: ['member'] },
      { label: 'My Invoices', href: '/my-invoices', icon: FileText, roles: ['member'] },
      { label: 'My Requests', href: '/my-requests', icon: UserCog, roles: ['member'] },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'Announcements', href: '/member-announcements', icon: Megaphone, roles: ['member'] },
      { label: 'Feedback', href: '/member-feedback', icon: MessageSquare, roles: ['member'] },
    ],
  },
];

// Trainer-specific menu
export const trainerMenuConfig: MenuSection[] = [
  {
    title: 'Dashboard',
    items: [
      { label: 'My Dashboard', href: '/trainer-dashboard', icon: LayoutDashboard, roles: ['trainer'] },
    ],
  },
  {
    title: 'Training',
    items: [
      { label: 'My Clients', href: '/my-clients', icon: Users, roles: ['trainer'] },
      { label: 'PT Sessions', href: '/pt-sessions', icon: Dumbbell, roles: ['trainer'] },
      { label: 'My Classes', href: '/classes', icon: Calendar, roles: ['trainer'] },
      { label: 'AI Fitness', href: '/ai-fitness', icon: Sparkles, roles: ['trainer'] },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'My Attendance', href: '/staff-attendance', icon: Clock, roles: ['trainer'] },
      { label: 'Announcements', href: '/announcements', icon: Megaphone, roles: ['trainer'] },
    ],
  },
];

// Staff-specific menu
export const staffMenuConfig: MenuSection[] = [
  {
    title: 'Core',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['staff'] },
    ],
  },
  {
    title: 'Member Management',
    items: [
      { label: 'Members', href: '/members', icon: Users, roles: ['staff'] },
      { label: 'Attendance', href: '/attendance', icon: Clock, roles: ['staff'] },
      { label: 'Leads', href: '/leads', icon: UserPlus, roles: ['staff'] },
      { label: 'Feedback', href: '/feedback', icon: MessageSquare, roles: ['staff'] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'POS', href: '/pos', icon: ShoppingCart, roles: ['staff'] },
      { label: 'Invoices', href: '/invoices', icon: FileText, roles: ['staff'] },
      { label: 'Lockers', href: '/lockers', icon: Lock, roles: ['staff'] },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, roles: ['staff'] },
    ],
  },
  {
    title: 'Communication',
    items: [
      { label: 'WhatsApp Chat', href: '/whatsapp-chat', icon: MessageSquare, roles: ['staff'] },
      { label: 'Announcements', href: '/announcements', icon: Megaphone, roles: ['staff'] },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'My Attendance', href: '/staff-attendance', icon: Clock, roles: ['staff'] },
    ],
  },
];

// Admin/Manager/Owner menu (full access)
export const adminMenuConfig: MenuSection[] = [
  {
    title: 'Core',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    title: 'Member Management',
    items: [
      { label: 'Members', href: '/members', icon: Users, roles: ['owner', 'admin', 'manager'] },
      { label: 'Attendance', href: '/attendance', icon: Clock, roles: ['owner', 'admin', 'manager'] },
      { label: 'Plans', href: '/plans', icon: CreditCard, roles: ['owner', 'admin', 'manager'] },
      { label: 'Feedback', href: '/feedback', icon: MessageSquare, roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    title: 'Training & Classes',
    items: [
      { label: 'Classes', href: '/classes', icon: Calendar, roles: ['owner', 'admin', 'manager'] },
      { label: 'PT Sessions', href: '/pt-sessions', icon: Dumbbell, roles: ['owner', 'admin', 'manager'] },
      { label: 'Trainers', href: '/trainers', icon: Dumbbell, roles: ['owner', 'admin', 'manager'] },
      { label: 'AI Fitness', href: '/ai-fitness', icon: Sparkles, roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    title: 'CRM & Engagement',
    items: [
      { label: 'Leads', href: '/leads', icon: UserPlus, roles: ['owner', 'admin', 'manager'] },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, roles: ['owner', 'admin', 'manager'] },
      { label: 'Announcements', href: '/announcements', icon: Megaphone, roles: ['owner', 'admin', 'manager'] },
      { label: 'Referrals', href: '/referrals', icon: Gift, roles: ['owner', 'admin', 'manager'] },
      { label: 'WhatsApp Chat', href: '/whatsapp-chat', icon: MessageSquare, roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    title: 'E-commerce',
    items: [
      { label: 'POS', href: '/pos', icon: ShoppingCart, roles: ['owner', 'admin', 'manager'] },
      { label: 'Products', href: '/products', icon: Package, roles: ['owner', 'admin', 'manager'] },
      { label: 'Categories', href: '/product-categories', icon: Tags, roles: ['owner', 'admin', 'manager'] },
      { label: 'Store Orders', href: '/store', icon: ShoppingBag, roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    title: 'Finance',
    items: [
      { label: 'Overview', href: '/finance', icon: Wallet, roles: ['owner', 'admin', 'manager'] },
      { label: 'Invoices', href: '/invoices', icon: FileText, roles: ['owner', 'admin', 'manager'] },
      { label: 'Payments', href: '/payments', icon: Wallet, roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Inventory', href: '/inventory', icon: Package, roles: ['owner', 'admin', 'manager'] },
      { label: 'Equipment', href: '/equipment-maintenance', icon: Wrench, roles: ['owner', 'admin', 'manager'] },
      { label: 'Lockers', href: '/lockers', icon: Lock, roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'HRM', href: '/hrm', icon: Briefcase, roles: ['owner', 'admin', 'manager'] },
      { label: 'Employees', href: '/employees', icon: Users, roles: ['owner', 'admin', 'manager'] },
      { label: 'Staff Attendance', href: '/staff-attendance', icon: Clock, roles: ['owner', 'admin', 'manager'] },
      { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['owner', 'admin', 'manager'] },
      { label: 'Audit Logs', href: '/audit-logs', icon: ClipboardList, roles: ['owner', 'admin'] },
      { label: 'Settings', href: '/settings', icon: Settings, roles: ['owner', 'admin'] },
    ],
  },
];

// Legacy menuConfig - kept for backward compatibility but use role-specific ones
export const menuConfig: MenuSection[] = adminMenuConfig;

// Helper function to get menu by primary role
export function getMenuForRole(roles: Array<{ role: AppRole }>): MenuSection[] {
  // Priority: member > trainer > staff > manager > admin > owner
  if (roles.some(r => r.role === 'member')) {
    return memberMenuConfig;
  }
  if (roles.some(r => r.role === 'trainer') && !roles.some(r => ['owner', 'admin', 'manager'].includes(r.role))) {
    return trainerMenuConfig;
  }
  if (roles.some(r => r.role === 'staff') && !roles.some(r => ['owner', 'admin', 'manager'].includes(r.role))) {
    return staffMenuConfig;
  }
  return adminMenuConfig;
}
