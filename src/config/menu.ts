import type { Database } from '@/integrations/supabase/types';
import {
  LayoutDashboard, Users, UserPlus, CreditCard, Calendar, Dumbbell, Package,
  Settings, ClipboardList, Megaphone, BarChart3, Wallet, Clock,
  Lock, Sparkles, ShoppingBag, ShoppingCart, Gift, FileText, Wrench, CheckSquare, 
  Briefcase, MessageSquare,
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

export const menuConfig: MenuSection[] = [
  {
    title: 'Core',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'admin', 'manager', 'staff', 'trainer'] },
    ],
  },
  {
    title: 'Member Management',
    items: [
      { label: 'Members', href: '/members', icon: Users, roles: ['owner', 'admin', 'manager', 'staff'] },
      { label: 'Leads', href: '/leads', icon: UserPlus, roles: ['owner', 'admin', 'manager', 'staff'] },
      { label: 'Attendance', href: '/attendance', icon: Clock, roles: ['owner', 'admin', 'manager', 'staff'] },
      { label: 'Feedback', href: '/feedback', icon: MessageSquare, roles: ['owner', 'admin', 'manager', 'staff'] },
      { label: 'Plans', href: '/plans', icon: CreditCard, roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    title: 'Training & Classes',
    items: [
      { label: 'Classes', href: '/classes', icon: Calendar, roles: ['owner', 'admin', 'manager', 'staff', 'trainer'] },
      { label: 'PT Sessions', href: '/pt-sessions', icon: Dumbbell, roles: ['owner', 'admin', 'manager', 'trainer'] },
      { label: 'Trainers', href: '/trainers', icon: Dumbbell, roles: ['owner', 'admin', 'manager'] },
      { label: 'AI Fitness', href: '/ai-fitness', icon: Sparkles, roles: ['owner', 'admin', 'manager', 'trainer'] },
    ],
  },
  {
    title: 'Revenue & Sales',
    items: [
      { label: 'Invoices', href: '/invoices', icon: FileText, roles: ['owner', 'admin', 'manager', 'staff'] },
      { label: 'Payments', href: '/payments', icon: Wallet, roles: ['owner', 'admin', 'manager'] },
      { label: 'POS', href: '/pos', icon: ShoppingCart, roles: ['owner', 'admin', 'manager', 'staff'] },
      { label: 'Store', href: '/store', icon: ShoppingBag, roles: ['owner', 'admin', 'manager'] },
      { label: 'Referrals', href: '/referrals', icon: Gift, roles: ['owner', 'admin', 'manager'] },
    ],
  },
  {
    title: 'Operations',
    items: [
      { label: 'Inventory', href: '/inventory', icon: Package, roles: ['owner', 'admin', 'manager'] },
      { label: 'Equipment', href: '/equipment-maintenance', icon: Wrench, roles: ['owner', 'admin', 'manager'] },
      { label: 'Lockers', href: '/lockers', icon: Lock, roles: ['owner', 'admin', 'manager', 'staff'] },
      { label: 'Tasks', href: '/tasks', icon: CheckSquare, roles: ['owner', 'admin', 'manager', 'staff'] },
      { label: 'Announcements', href: '/announcements', icon: Megaphone, roles: ['owner', 'admin', 'manager'] },
      { label: 'WhatsApp Chat', href: '/whatsapp-chat', icon: MessageSquare, roles: ['owner', 'admin', 'manager', 'staff'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { label: 'HRM', href: '/hrm', icon: Briefcase, roles: ['owner', 'admin', 'manager'] },
      { label: 'Employees', href: '/employees', icon: Users, roles: ['owner', 'admin', 'manager'] },
      { label: 'Staff Attendance', href: '/staff-attendance', icon: Clock, roles: ['owner', 'admin', 'manager', 'staff', 'trainer'] },
      { label: 'Analytics', href: '/analytics', icon: BarChart3, roles: ['owner', 'admin', 'manager'] },
      { label: 'Audit Logs', href: '/audit-logs', icon: ClipboardList, roles: ['owner', 'admin'] },
      { label: 'Settings', href: '/settings', icon: Settings, roles: ['owner', 'admin'] },
    ],
  },
];
