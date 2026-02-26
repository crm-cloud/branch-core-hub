

# Comprehensive Plan: 7 Fixes (Roles, Profile, Dashboard, Leads, Admin View-As)

## Analysis Summary

After deep codebase audit, here are findings for each of the 7 requests:

---

## 1. Remove "Owner" Role Label -- Admin IS the Owner

**Current State:** The `app_role` enum includes both `owner` and `admin`. Throughout the codebase (`menu.ts`, `DashboardRedirect.tsx`, `AppHeader.tsx`, route guards in `App.tsx`), both `owner` and `admin` are treated identically -- they always appear together in every `requiredRoles` array. The role badge in the dropdown still shows "owner".

**Fix:** This is a **display-only** change. We will NOT remove the `owner` role from the database enum (that would break existing data). Instead:
- In `AppHeader.tsx` dropdown label (line 120): Map `owner` to display as `"Admin"` instead of `"Owner"`
- This keeps backward compatibility while presenting the correct label to users

**Files:** `src/components/layout/AppHeader.tsx`

---

## 2. Dedicated Profile Page for All Roles (Admin/Staff/Trainer/Manager)

**Current State:** Clicking "Profile" in the header dropdown navigates to `/settings` (line 130). Only members have a dedicated `/member-profile` page. Admin/staff/trainer/manager users have NO profile page -- they get dumped into the Settings page which is about organization config, not personal info.

**Fix:** Create a new `/profile` page (`src/pages/Profile.tsx`) accessible to ALL roles that shows:
- **Left column (About card):** Avatar (read-only display), Full Name, Email, Phone, Role badge, Branch assignment
- **Right column (Activity card):** Recent activity timeline (last logins, actions -- placeholder for now)
- **Editable fields:** Phone, Emergency Contact (same restrictions as member profile)
- **"Reset Password" button** (same `resetPasswordForEmail` flow)
- Inspired by the Vuexy reference image (image-112): clean card layout with About section + Activity Timeline

**Route:** Add `/profile` route in `App.tsx` accessible to all authenticated roles.
**Header fix:** Change "Profile" dropdown item to navigate to `/profile` (for non-members) or `/member-profile` (for members).

**Files:**
- New: `src/pages/Profile.tsx`
- Edit: `src/App.tsx` (add route)
- Edit: `src/components/layout/AppHeader.tsx` (fix Profile navigation)

---

## 3. Admin EditProfileDrawer Shows All Fields (Name/Email/Phone)

**Current State:** The `EditProfileDrawer.tsx` (admin tool for editing member profiles) already shows Full Name, Email, Phone, Avatar upload, and Fitness Goal. Looking at the screenshots and the code, this appears to be working correctly -- all fields are present and editable for admins.

**Assessment:** No changes needed. The drawer already has all fields. The user's concern was likely that when THEY (as admin) click "Profile" it goes to Settings instead of a profile page (addressed in item 2 above).

---

## 4. Membership Distribution Widget -- UI/UX Improvement

**Current State:** The `MembershipDistribution` component renders a `PieChart` with a donut style. With only 1 plan and 1 member, it looks empty and unimpressive (as shown in image-111).

**Fix:** Replace the pie chart with a **horizontal stacked-bar + stats card** widget that looks good even with minimal data:
- Show each plan as a colored horizontal progress bar with member count and percentage
- Add total active members count prominently at top
- Add "vs last month" growth indicator
- When only 1 plan exists, show a clean single-bar layout instead of a sad partial circle
- Fallback: "No active memberships" with a CTA to add plans

**Files:** `src/components/dashboard/DashboardCharts.tsx` (replace `MembershipDistribution` component)

---

## 5. Profile Page Design (Vuexy Reference)

Addressed as part of item 2. The new `/profile` page will follow the Vuexy-style layout:
- Left card: "ABOUT" section with icon-labeled fields (Full Name, Status, Role, Branch, Email, Phone)
- Right card: "Activity Timeline" with recent events
- Tabs at top: Profile | Settings (link to /settings for admins)
- Clean, card-based layout with proper spacing

---

## 6. Lead Management -- External Capture Integration Plan

**Current State:** Leads are captured ONLY via the public website form (`/` route) through the `capture-lead` edge function. There's no way to capture leads from Instagram, Facebook, Google Ads, or external forms.

**Fix -- Phase 1 (Implementable now):**

**A) Public API Endpoint for External Forms:**
- The `capture-lead` edge function already exists and accepts `{ fullName, phone, email, source }`. It's publicly callable.
- Add support for a `utm_source`, `utm_medium`, `utm_campaign` fields to track where leads come from
- Add a `source` field expansion: `'instagram'`, `'facebook'`, `'google_ads'`, `'landing_page'`, `'api'` to the allowed sources
- Add an optional `api_key` parameter for authenticated external submissions (to prevent spam from non-website sources)

**B) Embeddable Form Widget:**
- Create a new page `/embed/lead-form` that renders a minimal, standalone lead capture form (no sidebar/header)
- This can be embedded as an `<iframe>` on any external website, landing page, or Instagram bio link
- The form posts to the same `capture-lead` edge function

**C) Webhook Receiver for Zapier/Make:**
- Create a new edge function `webhook-lead-capture` that accepts POST requests with a shared secret
- This allows connecting Instagram Lead Ads, Facebook Lead Ads, Google Forms, Typeform, etc. via Zapier/Make
- Validates an `X-Webhook-Secret` header for security

**D) Lead Source Tracking UI:**
- Add a "Lead Sources" breakdown widget to the Leads page showing where leads are coming from (website vs Instagram vs walk-in etc.)

**Files:**
- Edit: `supabase/functions/capture-lead/index.ts` (expand allowed sources, add UTM fields)
- New: `supabase/functions/webhook-lead-capture/index.ts` (webhook receiver)
- New: `src/pages/EmbedLeadForm.tsx` (embeddable form)
- Edit: `src/App.tsx` (add `/embed/lead-form` route)
- Edit: `src/pages/Leads.tsx` (add source breakdown widget)

---

## 7. Admin "View As" Role Switching

**Current State:** No mechanism exists for an admin to preview what a staff/trainer/member sees.

**Fix:** Add a "View As" feature in the admin header:
- Add a dropdown button in `AppHeader` (only visible to `owner`/`admin` roles)
- Options: "View as Manager", "View as Staff", "View as Trainer", "View as Member"
- When activated, store the "impersonated role" in React state (context level)
- The sidebar menu switches to that role's menu config
- A prominent banner appears at the top: "Viewing as [Role] -- Click to exit"
- This does NOT change actual database permissions -- only the UI/menu rendering
- Uses a new `ViewAsContext` that wraps the role-checking logic

**Important:** This is purely a UI preview tool. RLS policies still enforce real permissions. The admin can see the menu structure and page layouts but data queries still run with their actual auth token.

**Files:**
- New: `src/contexts/ViewAsContext.tsx`
- Edit: `src/components/layout/AppSidebar.tsx` (use ViewAs context for menu selection)
- Edit: `src/components/layout/AppHeader.tsx` (add View As dropdown + exit banner)
- Edit: `src/components/auth/DashboardRedirect.tsx` (respect ViewAs for redirect)
- Edit: `src/App.tsx` (wrap with ViewAsProvider)

---

## Execution Priority

| Step | Priority | Items | Description |
|------|----------|-------|-------------|
| 1 | Critical | #1, #2 | Fix owner label, create Profile page, fix header navigation |
| 2 | High | #4 | Replace Membership Distribution widget |
| 3 | High | #6 | Lead capture webhook + embeddable form + source tracking |
| 4 | Medium | #7 | Admin "View As" role switching |
| 5 | Low | #3 | No changes needed (already working) |

**Note on item #3:** The EditProfileDrawer already shows name/email/phone for admin editing. No code changes required.

