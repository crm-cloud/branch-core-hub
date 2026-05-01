import {
  UserPlus, Users, CreditCard, Wallet, FileText, LogIn, DoorOpen,
  Calendar, Dumbbell, Gift, Lock, MessageSquare, CheckSquare, ClipboardList,
  RefreshCw, ShoppingCart,
} from 'lucide-react';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

export interface CommandAction {
  id: string;
  label: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  route: string;
  roles: AppRole[];
}

/**
 * Each action navigates to the relevant page with a query flag.
 * The destination page reads the flag and opens the matching drawer,
 * then strips the flag from the URL.
 */
export const COMMAND_ACTIONS: CommandAction[] = [
  { id: 'add-member',         label: 'Add Member',           icon: UserPlus,    route: '/members?new=1',                  roles: ['owner','admin','manager','staff'] },
  { id: 'create-lead',        label: 'Create Lead',          icon: UserPlus,    route: '/leads?new=1',                    roles: ['owner','admin','manager','staff'] },
  { id: 'sell-membership',    label: 'Sell Membership',      icon: CreditCard,  route: '/members?sell=1',                 roles: ['owner','admin','manager','staff'] },
  { id: 'renew-membership',   label: 'Renew Membership',     icon: RefreshCw,   route: '/members?renew=1',                roles: ['owner','admin','manager','staff'] },
  { id: 'collect-payment',    label: 'Collect Payment',      icon: Wallet,      route: '/payments?new=1',                 roles: ['owner','admin','manager','staff'] },
  { id: 'create-invoice',     label: 'Create Invoice',       icon: FileText,    route: '/invoices?new=1',                 roles: ['owner','admin','manager','staff'] },
  { id: 'check-in',           label: 'Check In Member',      icon: LogIn,       route: '/attendance-dashboard?checkin=1', roles: ['owner','admin','manager','staff'] },
  { id: 'force-entry',        label: 'Force Entry',          icon: DoorOpen,    route: '/attendance-dashboard?force=1',   roles: ['owner','admin','manager'] },
  { id: 'book-facility',      label: 'Book Facility',        icon: Calendar,    route: '/all-bookings?facility=1',        roles: ['owner','admin','manager','staff'] },
  { id: 'book-class',         label: 'Book Class',           icon: Calendar,    route: '/all-bookings?class=1',           roles: ['owner','admin','manager','staff'] },
  { id: 'sell-addon',         label: 'Sell Benefit Add-on',  icon: Gift,        route: '/pos?addon=1',                    roles: ['owner','admin','manager','staff'] },
  { id: 'sell-pt',            label: 'Sell PT Package',      icon: Dumbbell,    route: '/pt-sessions?new=1',              roles: ['owner','admin','manager','staff'] },
  { id: 'assign-locker',      label: 'Assign Locker',        icon: Lock,        route: '/lockers?assign=1',               roles: ['owner','admin','manager','staff'] },
  { id: 'open-whatsapp',      label: 'Open WhatsApp Chat',   icon: MessageSquare, route: '/whatsapp-chat',                roles: ['owner','admin','manager','staff','trainer'] },
  { id: 'create-task',        label: 'Create Task',          icon: CheckSquare, route: '/tasks?new=1',                    roles: ['owner','admin','manager','staff','trainer'] },
  { id: 'create-approval',    label: 'Create Approval Request', icon: ClipboardList, route: '/approvals?new=1',           roles: ['owner','admin','manager'] },
];

export function filterActionsForRoles(rolesSet: Set<AppRole>, query: string) {
  const q = query.trim().toLowerCase();
  return COMMAND_ACTIONS.filter((a) => a.roles.some((r) => rolesSet.has(r)))
    .filter((a) => !q || a.label.toLowerCase().includes(q))
    .slice(0, 10);
}
