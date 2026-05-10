## Audit findings

1. **Reset-password link is being sent, but the clicked token is already invalid/consumed**
   - Auth logs show `/recover` succeeds, then `/verify` returns **“Email link is invalid or has expired / One-time token not found”**.
   - That usually means the recovery link was opened more than once, pre-opened by an email/security scanner, or the user clicked an older reset email after requesting a newer one.
   - Current app also sends reset links from multiple places (`Forgot password`, `Profile`, `Member profile`) all pointing to `/auth/reset-password`, so repeated requests can invalidate older links.

2. **The reset callback page is fragile**
   - `/auth/reset-password` only checks whether `user` exists.
   - It does not explicitly wait for password-recovery auth state or show a proper “verifying reset link” state.
   - If the app loads before the recovery session is established, it can immediately say invalid/expired and redirect to `/auth`.

3. **Email code login is confusing and currently not reliable for this project**
   - `/auth` has an “Email code” tab using `signInWithOtp()` and a 6-digit OTP field.
   - No branded email sender domain is configured in this workspace, so relying on auth email OTP creates confusion.
   - If the code delivery is inconsistent, the field should be hidden instead of presented as a normal sign-in path.

4. **Default/temporary password onboarding already partially exists**
   - Member, staff, and admin creation functions already create users with a generated temporary password and set `profiles.must_set_password = true`.
   - Problem: the temporary password is random and not visible/usable by staff, so users still depend on reset/magic-link email to enter the app.

## Recommended product decision

Use **password-first onboarding** for operational gym users:

- Admin/manager creates member/trainer/staff/manager with a temporary password.
- User signs in with email + temporary password.
- App immediately redirects them to `/auth/set-password` because `must_set_password = true`.
- They choose their own password.
- Email reset stays available as a backup, not the primary onboarding path.

This is safer and clearer than relying on magic links/OTP for every gym member.

## Implementation plan

### 1. Fix the reset-password callback UX
- Update `ResetPasswordForm` to:
  - Show a “Verifying reset link” loading state first.
  - Wait for the auth recovery session instead of instantly redirecting when `user` is temporarily null.
  - Detect expired/invalid link errors from the URL and show a clear recovery message.
  - Provide actions: **Request a new reset link** and **Back to sign in**.
- Keep `/auth/reset-password` as the only reset callback path.
- Keep the existing `redirectTo: ${window.location.origin}/auth/reset-password` usage.

### 2. Remove/hide confusing Email Code sign-in
- Remove the “Email code” tab and 6-digit OTP field from `LoginForm` for now.
- Keep only email + password on `/auth`.
- Remove unused OTP UI imports and auth context methods if no longer used elsewhere.
- Result: users will not see a code field that may never receive a code.

### 3. Add default-password onboarding path
- Update user creation flows for:
  - member
  - trainer/staff/manager
  - admin/owner-created users
- Instead of only generating a hidden random temp password, allow the creator to set or copy a temporary password.
- Keep `must_set_password = true`, so the first successful login still forces the user to change it.
- Never store the temporary password in public tables.

### 4. Make the UI clear for staff/admins
- On create-user drawers/pages, add a temporary password field with:
  - “Generate” action
  - “Copy” action
  - helper text: “User must change this after first login.”
- For security, show it only at creation time.
- Do not send it automatically by email unless a reliable transactional email setup is added later.

### 5. Harden auth configuration
- Enable leaked-password protection for stronger password safety.
- Keep email signups disabled if this is staff-created-account only.
- Do not enable anonymous signups.

## Technical notes

- Files to update:
  - `src/components/auth/LoginForm.tsx`
  - `src/contexts/AuthContext.tsx`
  - `src/components/auth/ResetPasswordForm.tsx`
  - `src/components/auth/ResetPasswordRequestForm.tsx`
  - user creation UI/services for members, staff, trainers, managers/admins
  - `supabase/functions/create-member-user/index.ts`
  - `supabase/functions/create-staff-user/index.ts`
  - `supabase/functions/admin-create-user/index.ts`
- No schema change is required for the default-password flow unless we want to add audit metadata like “temporary password issued at”.
- If later you want reliable email reset/code delivery, the proper path is to configure a sender domain in Cloud Emails and use branded auth emails.