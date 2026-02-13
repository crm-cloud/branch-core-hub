
# Member Portal Overhaul: Frozen State, Referrals, Unified Booking

## Module 1: Unified "Book and Schedule" Hub (Priority 1)

**Current State:** The member sidebar has separate "Book Classes" (/my-classes) and "My Benefits" (/my-benefits) pages. The BookBenefitSlot page (/book-benefit) already has gender-based facility filtering.

**Changes:**

### 1a. Rename and restructure MemberClassBooking page
- **File:** `src/pages/MemberClassBooking.tsx`
- Rename page title from "Class Booking" to "Book & Schedule"
- Add 3 top-level tabs: **Group Classes** | **Recovery Zone** | **PT Sessions**
- "Group Classes" tab = current browse/bookings content (no change to logic)
- "Recovery Zone" tab = embed the existing BookBenefitSlot logic (slot browsing with gender filtering, booking, cancellation) directly into this tab
- "PT Sessions" tab = embed the existing MyPTSessions content (upcoming/past sessions list)

### 1b. Update sidebar navigation
- **File:** `src/config/menu.ts`
- Rename "Book Classes" to "Book & Schedule" (keep href `/my-classes`)
- Remove "PT Sessions" from the Fitness section (it's now inside the unified hub)
- Keep "My Benefits" in Services section (it shows credits/usage, different from booking)

### 1c. Update dashboard quick action
- **File:** `src/pages/MemberDashboard.tsx`
- Change "Book a Class" card text to "Book & Schedule"

### 1d. Route cleanup
- **File:** `src/App.tsx`
- Keep `/my-pt-sessions` route but add a redirect to `/my-classes?tab=appointments` for backward compatibility
- Keep `/book-benefit` route as-is (still accessible from My Benefits page)

---

## Module 2: Frozen Dashboard UI (Priority 2)

**Current State:** The MemberDashboard does not check for `activeMembership?.status === 'frozen'`. The useMemberData hook already fetches memberships with `status in ('active', 'frozen')`, so the data is available.

**Changes:**

### 2a. Update dashboard for frozen state
- **File:** `src/pages/MemberDashboard.tsx`
- Add `const isFrozen = activeMembership?.status === 'frozen';`
- **Status Badge (top-right):** If frozen, show a blue "Membership Frozen" badge with Snowflake icon instead of green "Active Membership"
- **Membership Status stat card:** If frozen, show "Membership Paused" instead of "364 days remaining"
- **Alert Card:** If frozen, render a prominent blue alert card at the top with: "Your membership is currently frozen. Gym access and bookings are disabled." and a "Request Unfreeze" button linking to `/my-requests`
- **Quick Action cards:** If frozen, gray out "Book a Class" and disable the link. Replace with a disabled state showing a lock icon
- **Membership Details card:** Show "Status: Frozen" with a blue badge and snowflake icon

### 2b. No changes needed to MemberRequests
The unfreeze request flow already exists in `src/pages/MemberRequests.tsx` with the `isFrozen` check and unfreeze Sheet. The dashboard just needs to link there.

---

## Module 3: Member Referral System (Priority 3)

**Current State:** The admin Referrals page exists at `/referrals`. The `referrals` table has `referral_code`, `referrer_member_id`, `referred_member_id`, and `status`. There is a `referral_rewards` table. No member-facing referral page exists. Members don't have a stored referral code.

**Changes:**

### 3a. Create Member Referral Page
- **New File:** `src/pages/MemberReferrals.tsx`
- Generate a referral code from the member's name + year (e.g., "KULDEEP-2026") or use the member_code
- **Share Section:**
  - "Copy Link" button that copies a URL with the referral code
  - "Share on WhatsApp" button that opens `https://wa.me/?text=...` with a pre-filled invite message
- **Tracker Widget:** 3 stat cards showing:
  - Referrals Sent (count from referrals table where referrer = current member)
  - Successful Signups (count where status = 'converted')
  - Rewards Earned (sum from referral_rewards)
- **Referral History:** List of referrals with status badges
- **Rewards Section:** List of rewards with claim buttons (reuse existing `claimReward` service)

### 3b. Add route
- **File:** `src/App.tsx`
- Add `/my-referrals` route with member role protection

### 3c. Add to sidebar
- **File:** `src/config/menu.ts`
- Add "Refer & Earn" with Gift icon under the Services section of memberMenuConfig

### 3d. Add to dashboard
- **File:** `src/pages/MemberDashboard.tsx`
- Optionally add a "Refer & Earn" quick action card linking to `/my-referrals`

---

## Database Changes

**No migrations required.** All tables (referrals, referral_rewards, members, memberships, benefit_slots, facilities) already exist with the needed columns. The gender filter for facilities is already implemented in BookBenefitSlot.

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `src/pages/MemberClassBooking.tsx` | Major edit | Add 3-tab layout, embed Recovery Zone and PT Sessions |
| `src/config/menu.ts` | Edit | Rename sidebar item, remove PT Sessions, add Refer & Earn |
| `src/pages/MemberDashboard.tsx` | Edit | Add frozen state UI, rename quick action, add referral card |
| `src/pages/MemberReferrals.tsx` | New | Member-facing referral + rewards page |
| `src/App.tsx` | Edit | Add /my-referrals route, redirect /my-pt-sessions |
