

# Comprehensive UX Overhaul: Navigation, Workflows, and Performance

This plan addresses navigation discoverability, role consistency, branch scoping, auth UX, dashboard performance, and end-to-end workflow reliability across all 6 roles.

---

## UX Strategy Summary

**Top problems solved:**
1. Orphan routes (`/admin-roles`, `/book-benefit`, `/employees`, `/my-plans`, `/my-pt-sessions`, `/equipment`) are unreachable from menus
2. Role redirect logic is duplicated across 4 files (`DashboardRedirect`, `ProtectedRoute`, `Auth.tsx`, `SetPassword.tsx`)
3. Branch context has no failure/empty states — restricted roles see broken data silently
4. Dashboard loads all 12+ queries simultaneously with no progressive rendering
5. Unauthorized page always links to `/dashboard` regardless of role
6. No session timeout warning — users are silently signed out
7. Inactivity timer re-queries `organization_settings` on every mouse event

**Why the new IA is better:** Every route is reachable from its role menu. Menu sections are grouped by operational intent (Home, People, Operations, Finance, Communication, Admin) rather than feature type, reducing cognitive load. Under-discoverable pages are surfaced as sub-items or merged into existing sections.

---

## Phase 1: Quick Wins (Low Risk, High Impact)

### 1.1 Fix Orphan Routes in Menu Config

**File: `src/config/menu.ts`**

| Orphan Route | Where to Add | Section |
|---|---|---|
| `/admin-roles` | `adminMenuConfig` | Admin & HR (after Employees) |
| `/employees` | `adminMenuConfig` + `managerMenuConfig` | Admin & HR (already exists in admin, missing from sidebar for manager — add to manager) |
| `/equipment` | Merge into `/equipment-maintenance` or add to Operations | Operations section |
| `/book-benefit` | `memberMenuConfig` | Services → "Book Facility" |
| `/my-plans` | `memberMenuConfig` | My Account → "My Plans" |
| `/my-pt-sessions` | Already redirects to `/my-classes?tab=appointments` — add "PT Sessions" link to member menu | Fitness section |
| `/benefit-tracking` | `adminMenuConfig` Training & Bookings | Already present — confirmed |
| `Employees` for staff | `staffMenuConfig` | Add to a "People" section (read-only for staff) — NO, staff shouldn't see employees. Keep as-is. |

Changes to `menu.ts`:
- Add `{ label: 'Admin Roles', href: '/admin-roles', icon: UserCog, roles: ['owner', 'admin'] }` to admin `Admin & HR` section
- Add `{ label: 'Employees', href: '/employees', icon: Briefcase, roles: ['manager'] }` to manager `Admin & HR` section  
- Add `{ label: 'Staff Attendance', href: '/attendance-dashboard', icon: Clock, roles: ['manager'] }` to manager menu
- Add `{ label: 'Book Facility', href: '/book-benefit', icon: Calendar, roles: ['member'] }` to member `Services` section
- Add `{ label: 'My Plans', href: '/my-plans', icon: CreditCard, roles: ['member'] }` to member `My Account` section
- Add `{ label: 'My PT Sessions', href: '/my-pt-sessions', icon: Dumbbell, roles: ['member'] }` to member `Fitness` section

### 1.2 Centralize Role-Home Redirect Logic

**New file: `src/lib/roleRedirect.ts`**

```typescript
export function getHomePath(roles): string {
  if (roles.some(r => r.role === 'member')) return '/member-dashboard';
  if (roles.some(r => r.role === 'trainer') && !hasAdmin(roles)) return '/trainer-dashboard';
  if (roles.some(r => r.role === 'staff') && !hasAdmin(roles)) return '/staff-dashboard';
  return '/dashboard';
}
```

Then update `DashboardRedirect.tsx`, `ProtectedRoute.tsx`, `Auth.tsx`, and `SetPassword.tsx` to import and use this single function. Eliminates 4x duplication.

### 1.3 Fix Unauthorized Page Role-Aware Redirect

**File: `src/pages/Unauthorized.tsx`**

- Import `useAuth` and `getHomePath`
- Change "Back to Dashboard" link from hardcoded `/dashboard` to `getHomePath(roles)`
- Add contextual message: "You don't have access to this section. You've been redirected to your home area."

### 1.4 Branch Context Badge in Header

**File: `src/components/layout/AppHeader.tsx`**

- For non-owner/admin roles, show a permanent branch chip: `<Badge variant="secondary">📍 {branchName}</Badge>` next to the search bar
- This gives staff/trainers/members constant awareness of their scoped branch

### 1.5 Fix Inactivity Timer Performance

**File: `src/contexts/AuthContext.tsx`**

The current implementation calls `supabase.from('organization_settings')` on EVERY mouse/key/scroll event. Fix:
- Fetch timeout value once on mount and cache it in a ref
- Only re-fetch on `refreshProfile()` calls
- This eliminates hundreds of unnecessary DB queries per session

---

## Phase 2: Structural Changes

### 2.1 Branch Context Failure States

**File: `src/contexts/BranchContext.tsx`**

Add explicit state handling:
- `branchStatus: 'loading' | 'ready' | 'no_branch_assigned' | 'error'`
- When staff/trainer/member has no branch assigned, expose `branchStatus = 'no_branch_assigned'`

**File: `src/components/layout/AppLayout.tsx`**

- When `branchStatus === 'loading'`: show skeleton in content area
- When `branchStatus === 'no_branch_assigned'`: show alert card: "No branch assigned to your account. Please contact your administrator."
- When `branchStatus === 'error'`: show retry button
- Never silently fall through to "all branches" for restricted roles

### 2.2 Session Timeout Warning

**File: `src/contexts/AuthContext.tsx`**

- Track remaining time in state: `sessionExpiresIn: number | null`
- When 5 minutes remain, expose `showTimeoutWarning: true`
- Add `extendSession()` method that resets the timer

**New component: `src/components/auth/SessionTimeoutWarning.tsx`**

- Renders a toast-like banner: "Your session expires in X minutes. [Stay Signed In]"
- Clicking "Stay Signed In" calls `extendSession()`
- Mount in `AppLayout.tsx`

### 2.3 Progressive Dashboard Loading

**File: `src/pages/Dashboard.tsx`**

Currently loads 12+ queries simultaneously. Refactor:
- Split into above-the-fold (stats + hero card) and below-the-fold sections
- Use `React.lazy()` for chart components (`RevenueChart`, `AttendanceChart`, etc.)
- Wrap below-fold sections in `<Suspense fallback={<Skeleton />}>`
- Use `IntersectionObserver` or a simple `useInView` hook to defer rendering of LiveAccessLog, AIInsightsWidget, MemberVoiceWidget until they scroll into view
- Keep stat cards loading first with existing `StatCardSkeleton`

### 2.4 Auth Flow Polish

**Files: `src/pages/Auth.tsx`, `src/components/auth/LoginForm.tsx`**

- Add transition animation between password and OTP modes (fade/slide)
- After login success, show a brief "Welcome back, {name}" toast before redirect
- On login error, keep email field populated (already works) and auto-focus password
- On OTP verify error, clear OTP slots and re-focus first slot
- Ensure password reset flow has consistent gradient background across all 3 pages (Auth, ForgotPassword, ResetPassword) — already consistent, just verify

---

## Phase 3: Performance and Polish

### 3.1 Route-Level Code Splitting

**File: `src/App.tsx`**

Convert all page imports to lazy imports:
```typescript
const DashboardPage = lazy(() => import('./pages/Dashboard'));
const MembersPage = lazy(() => import('./pages/Members'));
// ... etc
```

Wrap `<Routes>` content in `<Suspense fallback={<GymLoader />}>`. This reduces initial bundle significantly since most users only need their role's pages.

### 3.2 Skeleton Consistency Audit

Ensure every page that uses `useQuery` shows appropriate skeleton/loading states:
- Dashboard: `StatCardSkeleton` (exists)
- Members list: `TableSkeleton` (exists)
- Finance/Payments: verify skeleton exists
- Member Dashboard: verify skeleton exists (currently uses a simple spinner — upgrade to skeleton cards)

### 3.3 Dark Mode Contrast Audit

Quick pass through key components to verify:
- Sidebar active state contrast in dark mode
- Card shadows in dark mode (currently `shadow-indigo-500/20` may not be visible)
- Badge colors maintain readability
- Form inputs have visible borders

---

## Role-by-Role Navigation Blueprint

### Member Menu (Updated)
| Section | Items |
|---|---|
| My Account | Dashboard, My Profile, My Plans*, My Attendance, My Progress |
| Fitness | Book & Schedule, PT Sessions*, Workout Plan, Diet Plan |
| Services | My Benefits, Book Facility*, Refer & Earn, Store, My Invoices, My Requests |
| Communication | Announcements, Feedback |

*New additions

### Trainer Menu (No changes needed)
| Section | Items |
|---|---|
| Dashboard | My Dashboard |
| Training | My Clients, PT Sessions, Schedule Session, My Classes, Plan Builder |
| Earnings | My Earnings |
| Work | My Attendance, Announcements |

### Staff Menu (No changes needed)
Already comprehensive with 6 sections.

### Manager Menu (Updated)
| Section | Items |
|---|---|
| Main | Dashboard, Analytics |
| Members & Leads | Leads, Members, Attendance, Plans, Referrals, Feedback |
| Training & Bookings | Classes, PT Sessions, Trainers, All Bookings |
| E-Commerce & Sales | POS, Products, Categories, Store Orders, Discount Coupons |
| Finance | Overview, Invoices, Payments |
| Operations & Comm | WhatsApp Chat, Announcements, Equipment, Lockers |
| Admin & HR | HRM, Employees*, Tasks, Approvals |

*New addition

### Admin/Owner Menu (Updated)
| Section | Items |
|---|---|
| (same as current) | + Admin Roles* in Admin & HR section |

*New addition

---

## Critical Flow Redesigns

### Auth Flow
- Current: Login → `/home` → role-based redirect
- Improved: Login → brief loading with "Welcome back" → role-based redirect
- Error: Clear error message with auto-focus on failed field
- No changes to route structure, just UX polish

### Unauthorized Access Flow
- Current: Generic "Access Denied" with hardcoded `/dashboard` link
- Improved: Role-aware redirect button using `getHomePath()`, contextual message

### Branch Scoping Failure Flow
- Current: Silent fallback to first branch or undefined behavior
- Improved: Explicit states (loading skeleton → error card with retry → "no branch assigned" alert)

---

## End-to-End Workflow Audit

### Member Onboarding
- **Risk**: New member created without branch assignment → BranchContext fails silently
- **Fix**: BranchContext shows "No branch assigned" alert instead of broken data
- **Acceptance**: Member with no branch sees clear message, not empty tables

### Membership Freeze/Cancel
- **Risk**: QuickFreezeDrawer now calls `revokeHardwareAccess` (fixed), but approval-based freeze via DB trigger has no hardware revocation
- **Fix**: Already documented in previous plan — `ApprovalRequestsDrawer` now calls revoke on freeze approval
- **Acceptance**: Frozen member physically blocked at turnstile within 30 seconds

### Invoice + Payment
- **Risk**: Partial payment doesn't always update `amount_paid` correctly when multiple payments exist
- **Fix**: Already handled by `recordManualPayment` in `paymentService.ts` — verify with acceptance test
- **Acceptance**: Invoice status transitions correctly: pending → partial → paid

### Biometric Sync
- **Risk**: `mips_person_id` can be null if sync fails — no retry UX
- **Fix**: Add a "Sync Status" badge on member profile showing `synced | pending | failed` based on `mips_person_id` and `hardware_access_status`
- **Acceptance**: Staff can see sync status and manually trigger re-sync

### WhatsApp Delivery
- **Risk**: No delivery state feedback — staff don't know if message was sent
- **Fix**: Already uses toast for success/failure — verify template send shows delivery status
- **Acceptance**: Toast confirms "Message sent" or shows error with retry

---

## Implementation Order

| Step | Files | Risk | Time |
|---|---|---|---|
| 1.1 Fix orphan routes in menu | `menu.ts` | Low | Small |
| 1.2 Centralize role redirect | New `roleRedirect.ts`, update 4 files | Low | Small |
| 1.3 Fix Unauthorized page | `Unauthorized.tsx` | Low | Small |
| 1.4 Branch badge in header | `AppHeader.tsx` | Low | Small |
| 1.5 Fix inactivity timer perf | `AuthContext.tsx` | Low | Small |
| 2.1 Branch context failure states | `BranchContext.tsx`, `AppLayout.tsx` | Medium | Medium |
| 2.2 Session timeout warning | `AuthContext.tsx`, new component | Medium | Medium |
| 2.3 Progressive dashboard loading | `Dashboard.tsx` | Medium | Medium |
| 2.4 Auth flow polish | `LoginForm.tsx` | Low | Small |
| 3.1 Route-level code splitting | `App.tsx` | Medium | Medium |
| 3.2 Skeleton consistency | Multiple pages | Low | Small |

---

## Acceptance Checklist

- [ ] Every route in `App.tsx` is reachable from at least one role's sidebar menu
- [ ] Role redirect logic exists in exactly one function (`getHomePath`)
- [ ] Unauthorized page redirects to role-appropriate dashboard
- [ ] Staff/Trainer/Member see their branch name in the header
- [ ] Branch fetch failure shows explicit error state with retry
- [ ] "No branch assigned" shows clear admin-contact message
- [ ] Session timeout shows 5-minute warning with extend option
- [ ] Inactivity timer does NOT query DB on every input event
- [ ] Dashboard above-fold loads within 2 seconds on mid-tier device
- [ ] Below-fold dashboard sections lazy-load on scroll
- [ ] All auth pages share consistent gradient background
- [ ] Dark mode maintains WCAG AA contrast ratios
- [ ] Touch targets >= 44px on mobile nav items

