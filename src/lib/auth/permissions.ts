/**
 * P4 — Capability registry.
 *
 * Single source of truth for "what can this role do?" on the client.
 * Mirrored on the server in `public.role_capabilities` + `has_capability(_user, _cap)`.
 *
 * Use these instead of inline `hasAnyRole(['owner','admin'])` checks so capability
 * drift is caught in one place.
 */

export type AppRole = 'owner' | 'admin' | 'manager' | 'staff' | 'trainer' | 'member';

export type Capability =
  | 'view_financials'
  | 'manage_staff'
  | 'record_payment'
  | 'approve_discount'
  | 'cross_branch_view'
  | 'manage_settings'
  | 'cancel_membership'
  | 'freeze_membership'
  | 'credit_member'
  | 'manage_devices'
  | 'manage_automations'
  | 'view_reconciliation'
  | 'book_facility';

const MATRIX: Record<Capability, AppRole[]> = {
  view_financials:     ['owner', 'admin', 'manager'],
  manage_staff:        ['owner', 'admin'],
  record_payment:      ['owner', 'admin', 'manager', 'staff'],
  approve_discount:    ['owner', 'admin', 'manager'],
  cross_branch_view:   ['owner', 'admin'],
  manage_settings:     ['owner', 'admin'],
  cancel_membership:   ['owner', 'admin', 'manager'],
  freeze_membership:   ['owner', 'admin', 'manager'],
  credit_member:       ['owner', 'admin', 'manager'],
  manage_devices:      ['owner', 'admin', 'manager'],
  manage_automations:  ['owner', 'admin'],
  view_reconciliation: ['owner', 'admin'],
  book_facility:       ['owner', 'admin', 'manager', 'staff', 'trainer', 'member'],
};

export function hasCapability(roles: AppRole[] | string[] | undefined, cap: Capability): boolean {
  if (!roles || roles.length === 0) return false;
  const allowed = MATRIX[cap];
  return roles.some((r) => allowed.includes(r as AppRole));
}

export const can = {
  viewFinancials:    (r?: string[]) => hasCapability(r, 'view_financials'),
  manageStaff:       (r?: string[]) => hasCapability(r, 'manage_staff'),
  recordPayment:     (r?: string[]) => hasCapability(r, 'record_payment'),
  approveDiscount:   (r?: string[]) => hasCapability(r, 'approve_discount'),
  crossBranchView:   (r?: string[]) => hasCapability(r, 'cross_branch_view'),
  manageSettings:    (r?: string[]) => hasCapability(r, 'manage_settings'),
  cancelMembership:  (r?: string[]) => hasCapability(r, 'cancel_membership'),
  freezeMembership:  (r?: string[]) => hasCapability(r, 'freeze_membership'),
  creditMember:      (r?: string[]) => hasCapability(r, 'credit_member'),
  manageDevices:     (r?: string[]) => hasCapability(r, 'manage_devices'),
  manageAutomations: (r?: string[]) => hasCapability(r, 'manage_automations'),
  viewReconciliation:(r?: string[]) => hasCapability(r, 'view_reconciliation'),
  bookFacility:      (r?: string[]) => hasCapability(r, 'book_facility'),
};
