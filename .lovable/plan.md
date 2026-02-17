

# Project Overhaul: Settings, Feedback Widget, Mobile Login & Booking Fix

## 1. Settings Page: Vertical Sidebar Layout + Logo Upload

**Current state:** The Settings page uses a horizontal `TabsList` with `grid-cols-11`, causing a cramped, scrollable layout on smaller screens.

**Changes to `src/pages/Settings.tsx`:**
- Replace the horizontal Tabs layout with a two-column layout:
  - Left column (w-64): Vertical navigation list with icons and labels (styled as clickable menu items)
  - Right column (flex-1): Content area for the active section
- Keep the same `searchParams`-based tab routing
- Use Shadcn Cards with proper padding for the sidebar items

**Changes to `src/components/settings/OrganizationSettings.tsx`:**
- Add a "Gym Logo" section at the top with a drag-and-drop image uploader
- Upload to the existing `avatars` storage bucket (public)
- Store the URL in an `organization_settings` table (or use the existing organization config if available)
- Add fields: Logo preview, "Upload Logo" dropzone, "Remove Logo" button
- Query/upsert organization settings on save

**Database migration:**
- Create `organization_settings` table if it doesn't exist (id, branch_id, name, logo_url, timezone, currency, fiscal_year_start, created_at, updated_at) with RLS policies for staff roles

---

## 2. "Member Voice" Feedback Widget on Admin Dashboard

**Changes to `src/pages/Dashboard.tsx`:**
- Add a new Card widget titled "Member Voice" in the bottom grid row
- Query: Fetch latest 5 feedback rows joined with member profiles (avatar, name)
- Display each row as: Avatar | Name | Message preview (truncated to ~60 chars) | Status badge (Pending=yellow, Approved=green, Rejected=red)
- Clicking a row opens the existing Feedback detail drawer (or navigates to /feedback)

**New component: `src/components/dashboard/MemberVoiceWidget.tsx`**
- Self-contained widget with its own query
- Uses the same feedback query pattern as `Feedback.tsx` (with profile lookup)
- Limit to 5 rows, ordered by `created_at DESC`
- "View All" link to `/feedback`

---

## 3. "Always-Open" Facility Booking (Already Mostly Fixed)

**Current state:** The `ensure_facility_slots` RPC (SECURITY DEFINER) already auto-generates slots server-side. The `MemberClassBooking.tsx` page calls `ensureSlotsForDateRange` which triggers this RPC. The Recovery tab already shows auto-generated slots.

**Remaining gap:** If the RPC fails silently or slots aren't generated due to timing, the member sees nothing.

**Changes to `src/pages/MemberClassBooking.tsx`:**
- Add a retry mechanism: if `recoverySlots` returns empty after slot generation completes, re-fetch once
- Add a user-friendly "No Recovery facilities configured" empty state (instead of generic "No sessions")
- Ensure the slot generation query has `staleTime: 0` (not `Infinity`) so it runs on each page visit, guaranteeing fresh slots

**Changes to `src/services/benefitBookingService.ts`:**
- No changes needed -- the RPC-based approach is already correct

---

## 4. Phone Number Login (OTP via Phone)

**Current state:** The LoginForm has two tabs: "Password" and "Email OTP". The OtpLoginForm only supports email-based OTP.

**Changes to `src/components/auth/LoginForm.tsx`:**
- Add a third tab: "Phone OTP" (or change tabs to: Password | Email OTP | Phone OTP)
- Alternatively, restructure into: "Password" | "OTP" where OTP tab has a sub-toggle for Email vs Phone

**New component: `src/components/auth/PhoneOtpLoginForm.tsx`:**
- Step 1: Phone number input with country code prefix (+91 default for India)
- Step 2: OTP verification (6-digit, same InputOTP component)
- Uses `supabase.auth.signInWithOtp({ phone })` to send SMS OTP
- Uses `supabase.auth.verifyOtp({ phone, token, type: 'sms' })` to verify
- On success, navigate to `/home`

**Auth configuration:**
- Phone auth provider needs to be enabled (note: this requires Twilio or similar SMS provider credentials). Will need to check if Lovable Cloud supports phone auth natively or if API keys are needed.

**Changes to `src/contexts/AuthContext.tsx`:**
- Add `signInWithPhoneOtp` and `verifyPhoneOtp` methods if not already present

---

## Files Summary

| Priority | File | Change |
|----------|------|--------|
| 1 | `src/pages/MemberClassBooking.tsx` | Fix staleTime for slot generation; add retry; improve empty state |
| 2 | `src/pages/Settings.tsx` | Vertical sidebar layout replacing horizontal tabs |
| 2 | `src/components/settings/OrganizationSettings.tsx` | Add logo drag-and-drop uploader |
| 2 | Database migration | `organization_settings` table with RLS |
| 3 | `src/components/auth/PhoneOtpLoginForm.tsx` | New phone OTP login component |
| 3 | `src/components/auth/LoginForm.tsx` | Add Phone OTP tab |
| 3 | `src/contexts/AuthContext.tsx` | Add phone OTP auth methods |
| 4 | `src/components/dashboard/MemberVoiceWidget.tsx` | New feedback widget component |
| 4 | `src/pages/Dashboard.tsx` | Add Member Voice widget to dashboard grid |

---

## Technical Notes

**Settings sidebar pattern:**
```
+-------------------+----------------------------------+
| [icon] Org        |                                  |
| [icon] Branches   |    Active Section Content        |
| [icon] Benefits   |                                  |
| [icon] Referrals  |                                  |
| [icon] Templates  |                                  |
| [icon] Expenses   |                                  |
| [icon] Integrations                                  |
| [icon] Notifications                                 |
| [icon] Security   |                                  |
| [icon] Website    |                                  |
| [icon] Demo Data  |                                  |
+-------------------+----------------------------------+
```

**Phone OTP flow:**
- `signInWithOtp({ phone: '+91XXXXXXXXXX' })` sends SMS
- `verifyOtp({ phone, token, type: 'sms' })` verifies
- Requires SMS provider configuration (Twilio). Will check if secrets exist and prompt if needed.

**Logo upload:** Uses the existing public `avatars` bucket. The image URL is stored in `organization_settings.logo_url` and displayed in the sidebar header / login page.

