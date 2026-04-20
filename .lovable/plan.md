

## Scope assessment

Eight large items in one turn would mean shallow fixes everywhere. I'll **stage** the work — blockers + quick wins now, deeper audits across follow-up turns. Build errors must clear first or nothing else can deploy.

### Phase A — This turn (blockers + quick wins)

**A1. Fix 5 TypeScript build errors blocking all edge-function deploys**
- `_shared/ai-tool-executor.ts:181` — type the `reduce` callback.
- `_shared/ai-tools.ts` — relax `MemberContext`: `isMember?`, `membershipId?: string | null`, `planId?: string | null` so it accepts the caller's nullable values.
- Redeploy `whatsapp-webhook`, `meta-webhook` and verify green.

**A2. Speed up Register Modal lead submission (item #1)**
- Root cause: `RegisterModal.tsx` does a raw `fetch()` and waits for the edge function to finish lead-scoring + staff notifications + WhatsApp triggers before showing the success screen.
- Fix: switch to `supabase.functions.invoke('webhook-lead-capture')`, add a 12s client timeout, and inside the edge function move heavy work into `EdgeRuntime.waitUntil(...)` so the HTTP response returns the moment the lead row is inserted.

**A3. Theme + branch persistence verification (item #6)**
- Confirm `next-themes` localStorage isn't reset on auth events.
- Confirm `BranchContext` honours saved `selectedBranch` for managers/staff/trainers (not just admins) and only auto-picks when nothing is stored.

### Phase B — Follow-up turn (Meta + Google question)

**B1. Instagram → Google Business Profile (item #2)**
- Meta Graph API has **no** path that pushes IG posts to Google Business Profile. The Google share link you sent is just a share URL, not a sync endpoint.
- Real options need your pick (see Question 2).

### Phase C — Staged deeper audits (one focus per turn)

| Turn | Focus | Scope |
|---|---|---|
| C1 | Items #5a — Member enrollment → membership → invoice → payment → reminders end-to-end | Trace + fix broken links |
| C2 | Items #5b — MIPS sync, role triggers, trainer/staff/email/WhatsApp flows | Verify automation pipeline |
| C3 | Item #4 — Staff & Member Dashboard click-through audit | Every link/button checked |
| C4 | Items #3 + #7 + #8 — UI/UX polish, dead-table cleanup, Import/Export backup page | Vuexy sweep + new `/settings/backup` |

---

## Technical details (Phase A)

**Type fix**
```ts
// _shared/ai-tools.ts
export type MemberContext = {
  isMember?: boolean;
  memberId?: string;
  memberName: string;
  branchId: string;
  membershipId?: string | null;
  planId?: string | null;
  contextPrompt: string;
};

// _shared/ai-tool-executor.ts:181
const total = items.reduce(
  (s: number, i: { balance: number }) => s + i.balance,
  0,
);
```

**Edge function fast-return pattern**
```ts
const { data: lead } = await supabase.from('leads').insert(...).select().single();

EdgeRuntime.waitUntil((async () => {
  await scoreLeadAsync(lead.id);
  await notifyStaffAsync(lead);
  await fireWhatsAppTriggers(lead);
})());

return new Response(JSON.stringify({ success: true, lead_id: lead.id }), {
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
```

**Files touched in Phase A**
- `supabase/functions/_shared/ai-tools.ts`
- `supabase/functions/_shared/ai-tool-executor.ts`
- `supabase/functions/webhook-lead-capture/index.ts`
- `src/components/ui/RegisterModal.tsx`
- `src/contexts/BranchContext.tsx` (verify-only, edit only if bug found)

---

## Decisions needed before I start

**Q1 — Confirm Phase A scope**
- (a) **Phase A only this turn** (recommended, ships clean) — fix build errors, speed up Register Modal, verify theme/branch persistence.
- (b) Phase A + start C1 (enrollment→payment audit) — bigger turn, partial audit.
- (c) Different priority — tell me which item to do first.

**Q2 — Item #2 (Instagram → Google)**
- (a) Build Google Business Profile API connector (new OAuth + GBP API approval, 2–3 turns).
- (b) Use Zapier/Make/Buffer bridge (no app code, I'll document setup).
- (c) Skip — keep IG and Google separate.

**Q3 — Item #8 (Import/Export backup)**
- (a) Full DB JSON export + JSON import with conflict strategy.
- (b) Per-table CSV export only.
- (c) Both — JSON backup + per-table CSV.

**Q4 — Item #7 (Dead tables)**
- (a) Document only on System Health page.
- (b) Migration to drop confirmed-empty tables (`role_permissions`, `settings`, `payment_transactions`, `payroll_rules`).
- (c) Migrate org-wide data into branch-scoped tables (multi-turn refactor).

