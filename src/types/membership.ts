import type { Database } from '@/integrations/supabase/types';

// Enums from database
export type MemberStatus = Database['public']['Enums']['member_status'];
export type MembershipStatus = Database['public']['Enums']['membership_status'];
export type InvoiceStatus = Database['public']['Enums']['invoice_status'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];
export type PaymentMethod = Database['public']['Enums']['payment_method'];
export type ApprovalStatus = Database['public']['Enums']['approval_status'];
export type ApprovalType = Database['public']['Enums']['approval_type'];
export type BenefitType = Database['public']['Enums']['benefit_type'];
export type FrequencyType = Database['public']['Enums']['frequency_type'];
export type WalletTxnType = Database['public']['Enums']['wallet_txn_type'];

// Table types
export type Branch = Database['public']['Tables']['branches']['Row'];
export type MembershipPlan = Database['public']['Tables']['membership_plans']['Row'];
export type PlanBenefit = Database['public']['Tables']['plan_benefits']['Row'];
export type Member = Database['public']['Tables']['members']['Row'];
export type Membership = Database['public']['Tables']['memberships']['Row'];
export type MembershipFreeDay = Database['public']['Tables']['membership_free_days']['Row'];
export type MembershipFreezeHistory = Database['public']['Tables']['membership_freeze_history']['Row'];
export type Invoice = Database['public']['Tables']['invoices']['Row'];
export type InvoiceItem = Database['public']['Tables']['invoice_items']['Row'];
export type Payment = Database['public']['Tables']['payments']['Row'];
export type Wallet = Database['public']['Tables']['wallets']['Row'];
export type WalletTransaction = Database['public']['Tables']['wallet_transactions']['Row'];
export type ApprovalRequest = Database['public']['Tables']['approval_requests']['Row'];
export type BenefitUsage = Database['public']['Tables']['benefit_usage']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

// Extended types with relations
export interface MembershipPlanWithBenefits extends MembershipPlan {
  plan_benefits: PlanBenefit[];
}

export interface MembershipWithPlan extends Membership {
  membership_plans: MembershipPlan;
}

export interface MemberWithProfile extends Member {
  profiles?: Profile;
  memberships?: MembershipWithPlan[];
}

export interface InvoiceWithItems extends Invoice {
  invoice_items: InvoiceItem[];
  members?: Member & { profiles?: Profile };
}

export interface PaymentWithInvoice extends Payment {
  invoices?: Invoice;
  members?: Member & { profiles?: Profile };
}

// Utility types
export interface DaysRemaining {
  total: number;
  frozen: number;
  active: number;
  isExpired: boolean;
  isFrozen: boolean;
}

export interface PurchaseRequest {
  memberId: string;
  planId: string;
  branchId: string;
  startDate: string;
  discountAmount?: number;
  discountReason?: string;
  useWallet?: boolean;
  paymentMethod?: PaymentMethod;
}

export interface FreezeRequest {
  membershipId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  isPaid?: boolean;
}

export interface TransferRequest {
  memberId: string;
  fromBranchId: string;
  toBranchId: string;
  reason?: string;
}