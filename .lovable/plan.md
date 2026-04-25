# Member Lifecycle & Infrastructure Hardening Plan

Implement 8 production-grade fixes across referral lifecycle, media storage, communication delivery, and 3D avatar pipeline. Backend authority is preferred over client orchestration throughout.

---

## 1. Purchase Flow — Remove Duplicate Referral Processing

**File:** `src/components/members/PurchaseMembershipDrawer.tsx`

- Remove the post-RPC client block that updates `referrals.status` and inserts into `referral_rewards`.
- Trust `purchase_member_membership` RPC + `notify_referral_converted` DB trigger as the single authority.
- Keep React Query invalidations for `['referrals']`, `['referral-rewards']` so UI refreshes from authoritative state.

---

## 2. Member Onboarding — Single Referral Lifecycle

**Files:** `src/components/members/AddMemberDrawer.tsx`, `supabase/functions/create-member-user/index.ts`

- Remove the second client-side `referrals` insert in `AddMemberDrawer` after `create-member-user` returns.
- Move referral-row creation into `create-member-user` edge function (server-side, transactional with member creation).
- Lifecycle stays: `invited → joined → purchased → converted → rewarded → claimed`, all owned by backend.

---

## 3. Reward Claim — Atomic Backend RPC

**Files:** new migration adding `claim_referral_reward(p_reward_id uuid)` SECURITY DEFINER RPC, `src/services/referralService.ts`

- Create RPC that, in a single transaction:
  - Locks reward row, validates ownership + `is_claimed = false`
  - Credits wallet via existing wallet ledger function
  - Marks reward `is_claimed = true`, sets `claimed_at`
  - Returns updated reward
- Replace `claimReward()` in `referralService.ts` to just call `supabase.rpc('claim_referral_reward', { p_reward_id })`.
- Remove client-side `creditWallet` call — it's now inside the RPC, idempotent and atomic.

---

## 4. Biometric / Profile Media — Private Storage Path Model

**Files:** `src/components/members/MemberAvatarUpload.tsx`, `src/components/common/StaffAvatarUpload.tsx`, `src/components/common/StaffBiometricsTab.tsx`, `src/services/biometricService.ts`, new helper `src/lib/media/biometricPhotoUrls.ts`, migration adding `biometric_photo_path` columns

- Migrate uploads from public `avatars` bucket to private `member-photos` bucket under `biometric/{type}/{id}.jpg`.
- Add `biometric_photo_path` column to `members`, `employees`, `trainers` (text, nullable). Keep legacy `biometric_photo_url` for backward compat but stop writing it for new uploads.
- New helper `resolveBiometricPhotoUrl(path)` returns 1-hour signed URL; cache via React Query.
- Update `queueMemberSync` / `queueStaffSync` / `queueTrainerSync` to accept storage path and resolve a fresh signed URL when pushing to MIPS edge function (so device gets a working URL at sync-time, not stored stale).
- UI shows signed URLs via the helper.

---

## 5. Registration Form — Hard Duplicate Block

**Files:** `src/components/members/DocumentVaultTab.tsx`, migration on `member_documents`

- Add a partial unique index:
  `CREATE UNIQUE INDEX uniq_member_registration_form ON member_documents(member_id) WHERE document_type = 'registration_form';`
- In `DocumentVaultTab`:
  - Query whether a `registration_form` already exists for the member.
  - If it does, remove `registration_form` from the type `<Select>` options.
  - If user somehow attempts upload, catch the unique-violation and show a clear toast.

---

## 6. Reminder Delivery — Honest Status Tracking

**Files:** `supabase/functions/send-reminders/index.ts`, schema updates on `reminders` (or equivalent) table

- Add columns: `delivery_status` (`pending|sent|failed|skipped`), `delivery_channel`, `delivery_error`, `delivered_at`.
- Refactor `send-reminders` to:
  - Resolve channel(s) from reminder configuration.
  - For each channel, invoke `send-email` / `send-whatsapp` / `send-sms` and inspect response.
  - Mark `sent` only on provider success; `failed` with error message on failure; `skipped` if channel unconfigured for branch.
  - In-app notification creation stays separate and is not conflated with outbound delivery state.
- Audit UI (Reminders page) reads new columns to show truthful per-channel delivery state.

---

## 7. Progress Photo URLs — Auto-Refresh Strategy

**Files:** `src/lib/measurements/photoSigning.ts`, hooks like `src/hooks/useMemberMeasurements.ts` (or wherever photos are consumed)

- Lower TTL to 30 minutes (private bucket stays private).
- Tag signed URLs with an `expiresAt` timestamp on the hydrated record.
- React Query: set `staleTime: 25 minutes`, `refetchInterval: 25 minutes`, `refetchIntervalInBackground: false` for measurement queries.
- Add a lightweight `useSignedUrlRefresh()` hook that, on `visibilitychange` to `visible`, invalidates measurement queries if any photo is within 5 minutes of expiry.

---

## 8. 3D Body — Production-Ready GLB Pipeline

**Files:** `src/components/progress3d/AvatarGltf.tsx`, new `public/models/README.md`

- Cache the HEAD-probe result per URL (module-level `Map<string, Promise<boolean>>`) so we don't re-probe on every mount.
- Wrap `<GltfMesh>` in a small error boundary that, on GLB load failure, falls back to `<BodyModel>` and logs once.
- Tolerate alternate morph-target naming: try snapshot key, then common Ready Player Me / Mixamo aliases (e.g., `waistWidth` → `Waist`, `chestVolume` → `Chest`).
- Add `public/models/README.md` documenting expected files (`avatar-male.glb`, `avatar-female.glb`), recommended sources, target morph-target names, and the auto-fallback behavior so production can drop assets in without code changes.

---

## Acceptance Criteria Mapping

| # | Acceptance criterion | Covered by |
|---|---|---|
| 1 | Purchase no longer double-processes referral | §1 |
| 2 | Onboarding doesn't create duplicate referrals | §2 |
| 3 | Reward claim uses atomic RPC | §3 |
| 4 | Biometric/profile uploads off public URLs | §4 |
| 5 | Registration form cannot be uploaded twice | §5 |
| 6 | Reminders only marked sent on real delivery | §6 |
| 7 | Progress photos survive long sessions | §7 |
| 8 | 3D body uses GLB when present, fallback safely | §8 |

## Non-Regressions Preserved

- Access tab stays removed
- Quick Print stays removed
- Registration form single-upload behavior reinforced
- Recent activity improvements untouched
- Document signed-URL handling untouched
- WhatsApp Templates Manager hub untouched

## Migrations Required

1. `claim_referral_reward(uuid)` RPC + grants
2. `biometric_photo_path` columns on `members`, `employees`, `trainers`
3. Partial unique index on `member_documents` for `registration_form`
4. `delivery_status` / `delivery_channel` / `delivery_error` / `delivered_at` columns on the reminders table

After approval, I'll implement these in the above order so each migration is in place before the code that depends on it.