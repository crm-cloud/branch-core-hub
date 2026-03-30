

# Comprehensive MIPS Integration & UI/UX Overhaul Plan

This plan consolidates the 5 Epic Modules and 4 Integration Parts into actionable implementation steps, eliminating duplicate requests.

## Current State Summary

- `revoke-mips-access` edge function already exists and correctly uses `2000-01-01` for revocation. The 2099 fallback was already removed in the last fix.
- `sync-to-mips` still uses `PERMANENT_END = "2099-12-31"` for **staff/trainers only** (correct behavior for non-members).
- `mips-webhook-receiver` already has `normalizeScanTime()`, 3-tier person lookup, and correct `not_found` result handling.
- `LiveAccessLog.tsx` already has member photos, billing badges, and manual override button.
- `QuickFreezeDrawer` already calls `revokeHardwareAccess()`.
- `CancelMembershipDrawer` already calls `revokeHardwareAccess()`.
- `AttendanceDashboard` already has bulk check-out.
- No `rewards_ledger` table exists — only `referral_rewards` for referral program.
- `reinsertHyphen` regex bug exists (only matches `letters + digits`, not alphanumeric codes like `EMPMM3FYN8U`).

## What Actually Needs Doing (De-duplicated)

### 1. Fix `reinsertHyphen` Regex Bug in Webhook

The current regex `^([A-Za-z]+)(\d{5})$` fails on alphanumeric codes. Fix to:
```typescript
const match = stripped.match(/^([A-Za-z]{3,4})([A-Za-z0-9]+)$/);
```

**File**: `supabase/functions/mips-webhook-receiver/index.ts` line 12

### 2. Live Access Feed Deduplication

Add client-side deduplication: if same `member_id` + same `result` appears within 60 seconds, collapse into one entry with a count badge. This prevents the "5x Yogita" clutter.

**File**: `src/components/devices/LiveAccessLog.tsx`

### 3. Add "Check-Out" Button to Live Access Feed

For entries where `result === "member"` (successful check-in), show a "Check Out" button that calls `member_check_out` RPC. Also add check-out for staff entries.

**File**: `src/components/devices/LiveAccessLog.tsx`

### 4. Rewards Ledger System (New Feature)

**DB Migration**: Create `rewards_ledger` table:
```sql
CREATE TABLE rewards_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE NOT NULL,
  branch_id uuid REFERENCES branches(id),
  points integer NOT NULL,
  reason text NOT NULL,
  reference_type text,
  reference_id text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id)
);
ALTER TABLE members ADD COLUMN IF NOT EXISTS reward_points integer DEFAULT 0;
```

**UI**: Add a "Rewards Wallet" card in `MemberProfileDrawer.tsx` showing point balance, transaction history, and a "Redeem" action button (staff-facing).

**File**: `src/components/members/MemberProfileDrawer.tsx`, new `src/components/members/RewardsWalletCard.tsx`, `src/components/members/RedeemPointsDrawer.tsx`

### 5. Freeze Workflow Enhancement

The `FreezeMembershipDrawer` already tracks free days, paid fees, and creates approval requests. What's missing:
- After approval-based freeze is approved (DB trigger `auto_freeze_membership` fires), there's no automatic hardware revocation. Add a call to `revokeHardwareAccess` in the approval flow.
- Add "Remaining Free Freeze Days" display prominently in the drawer.

**File**: `src/components/members/FreezeMembershipDrawer.tsx`, `src/components/approvals/ApprovalRequestsDrawer.tsx`

### 6. Device Management UI/UX Upgrade

Upgrade `DeviceManagement.tsx` and `MIPSDashboard.tsx` to premium Vuexy 2026 standards:
- Add glassmorphism-inspired cards with gradient hero section
- Glowing status dots (green pulse for online, red for offline)
- Display `public_ip` on device cards
- Add "Force Sync Fleet" button on dashboard that triggers `sync-to-mips` for all personnel
- Better data density and visual hierarchy

**Files**: `src/pages/DeviceManagement.tsx`, `src/components/devices/MIPSDashboard.tsx`, `src/components/devices/MIPSDevicesTab.tsx`

### 7. Payment Enforcement → Hardware Revocation

When an invoice passes its due date without payment, trigger hardware revocation. This requires a new check in `check-expired-access` edge function to also scan for overdue invoices.

**File**: `supabase/functions/check-expired-access/index.ts`

### 8. API Documentation Update

Update `.lovable/mips-api-reference.md` with the complete lifecycle state machine, exterior API paths, and all hardware sync triggers.

## Files to Create/Modify

| File | Action |
|---|---|
| `supabase/functions/mips-webhook-receiver/index.ts` | Fix `reinsertHyphen` regex |
| `src/components/devices/LiveAccessLog.tsx` | Add deduplication, check-out button, richer billing badges with amounts |
| `src/components/members/RewardsWalletCard.tsx` | **Create** — rewards balance + history |
| `src/components/members/RedeemPointsDrawer.tsx` | **Create** — redeem points drawer |
| `src/components/members/MemberProfileDrawer.tsx` | Add RewardsWalletCard tab |
| `src/components/members/FreezeMembershipDrawer.tsx` | Enhance remaining days display |
| `src/components/approvals/ApprovalRequestsDrawer.tsx` | Add hardware revoke on freeze approval |
| `src/pages/DeviceManagement.tsx` | UI/UX upgrade with premium design |
| `src/components/devices/MIPSDashboard.tsx` | Glassmorphism hero, fleet sync button |
| `src/components/devices/MIPSDevicesTab.tsx` | Public IP display, glowing status dots |
| `supabase/functions/check-expired-access/index.ts` | Add overdue invoice check |
| `.lovable/mips-api-reference.md` | Full documentation update |
| **DB Migration** | `rewards_ledger` table + `reward_points` on members |

## Implementation Order

1. DB migration (rewards_ledger, reward_points)
2. Fix webhook regex bug (quick deploy)
3. Live Access Feed overhaul (dedup + check-out + richer badges)
4. Rewards Wallet UI (card + redeem drawer + profile integration)
5. Freeze approval → hardware revoke wiring
6. Device Management UI/UX premium upgrade
7. Payment enforcement in check-expired-access
8. Documentation update

