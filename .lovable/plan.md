

# Enterprise Upgrade: Finance Chart, Invoice Avatars, Lead Filters, WA Templates & Role Gating

## Analysis of What Already Exists

- **Module 5 (Approval Engine)**: `approval_requests` table, `ApprovalQueue.tsx`, `audit_logs` table with full trigger-based logging — **already fully built**. No new tables needed.
- **Lead statuses**: Kanban view already shows all 6 statuses. Conversion already updates status to `converted`.
- **WhatsApp manual**: `communicationService.sendWhatsApp()` already opens `wa.me/`.
- **Transfer/Comp drawers**: Already route through approval workflow.

## What Needs to Be Built

### 1. Finance: Revenue by Payment Method Donut Chart
**File**: `src/pages/Finance.tsx`
- Add a new `useQuery` that groups `incomeData` (already fetched) by `payment_method` and sums `amount`.
- Add a Recharts `PieChart` (donut) card between the Revenue Report and Budget Summary cards in the 3-column grid.
- Colors: Cash (green), Card (blue), UPI (purple), Bank Transfer (amber), Other (gray).

### 2. Invoices: Avatar Support
**File**: `src/pages/Invoices.tsx`
- Update the select query (line 47-51) to include `avatar_url` in the profiles join: `profiles:user_id(full_name, email, phone, avatar_url)`.
- Update the Avatar component (line 251-255) to use `AvatarImage` with the fetched `avatar_url`.
- Import `AvatarImage` (currently only `AvatarFallback` is imported).

### 3. Staff Dashboard: View Pricing Drawer
**File**: `src/pages/StaffDashboard.tsx`
- Add a "View Pricing" quick action card.
- Create a simple Sheet that fetches active `membership_plans` and displays them in a table (Name, Duration, Price).
- Staff can reference this while talking to leads.

### 4. Leads: Default Status Filter
**File**: `src/pages/Leads.tsx`
- Add a `statusFilter` state defaulting to `['new', 'contacted', 'qualified', 'negotiation']` (excludes `converted` and `lost`).
- Add a multi-select or toggle chips for status filtering above the Kanban/List views.
- Apply the filter in `filteredLeads` useMemo.

### 5. WhatsApp: API Template Selector
**New file**: `src/components/communication/WhatsAppTemplateDrawer.tsx`
- A Sheet that fetches `templates` table (filtered by `channel = 'whatsapp'`) and displays them as selectable cards.
- On select, calls `supabase.functions.invoke('send-whatsapp', { body: { phone_number, content, branch_id } })`.
- Integrate into `MemberProfileDrawer.tsx` and lead action buttons as a second WA button ("Send API Template").

**Auto-trigger on lead creation**: In `AddLeadDrawer.tsx`, after successful lead creation, auto-send the "Lead Welcome" template via the send-whatsapp edge function if phone is provided.

### 6. Role-Gate Transfer/Comp for Staff
**File**: `src/components/members/MemberProfileDrawer.tsx`
- Import `useAuth` and check `hasAnyRole(['owner', 'admin', 'manager'])`.
- For staff role: hide "Transfer Branch", "Transfer Plan", and "Comp/Gift" buttons.
- Staff see "Request Transfer" / "Request Comp" instead, which creates an `approval_request` (this flow already exists in CompGiftDrawer — just need to label the button differently for staff).

## Files Summary

| File | Action |
|------|--------|
| `src/pages/Finance.tsx` | Add Payment Method donut chart |
| `src/pages/Invoices.tsx` | Add avatar_url to query + render AvatarImage |
| `src/pages/StaffDashboard.tsx` | Add "View Pricing" card + Sheet |
| `src/pages/Leads.tsx` | Add status filter, default hide converted/lost |
| `src/components/communication/WhatsAppTemplateDrawer.tsx` | **New** — Template selector for API WA |
| `src/components/members/MemberProfileDrawer.tsx` | Add WA template button, role-gate actions |
| `src/components/leads/AddLeadDrawer.tsx` | Auto-trigger Lead Welcome template |

## Execution Order
1. Finance donut chart
2. Invoice avatars
3. Staff pricing drawer
4. Lead status filter
5. WhatsApp template drawer + integration
6. Role-gating on profile actions

