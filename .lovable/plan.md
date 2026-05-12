## Audit Findings — `/fitness/*`

### 1. The PDFs look "different from what we designed" — because there are TWO PDF generators

The codebase has **two completely separate PDF engines** for fitness plans:

| Generator | Engine | Used by |
|---|---|---|
| `src/utils/pdfBlob.ts` → `buildPlanPdf()` | **jsPDF + autoTable** (real, branded, designed PDF) | `sendPlanToMember()`, `AssignPlanDrawer` "Send PDF on assign", `SendPlanPdfMenu`, `MemberPlans.tsx` |
| `src/utils/pdfGenerator.ts` → `generatePlanPDF()` | **`window.open` + HTML + print dialog** (legacy, unbranded) | `Templates.tsx` Download button, `PlanViewerSheet` Download, fitness preview download |

So the moment you click **Download** on a template card or in the plan viewer you get the legacy HTML‑print version. The moment WhatsApp/Email sends to the member, they get the polished `jsPDF` version. **Same plan, two completely different layouts** → exactly what the QA PDFs (`qa-diet.pdf`, `qa-workout.pdf`) show.

`pdfGenerator.ts` is also used elsewhere (HRM, InvoiceViewDrawer) but for fitness it must go.

### 2. `/fitness/templates` Edit flow — why Save / Cancel / Back feel broken

`ManualWorkoutEditor` (and the diet twin) push `meta` up to `CreateManual.tsx` like this:

```ts
const submit = editMode ? handleSaveTemplate : handlePreview;     // new fn ref each render
const primaryLabel = editMode ? 'Save Template' : ...;
useEffect(() => { onMetaChange?.({ canSubmit, submit, primaryLabel }); },
  [canSubmit, submit, primaryLabel, onMetaChange]);
```

`submit` is a fresh closure every render → effect fires every render → parent `setMeta(...)` → parent re‑renders → editor re‑renders → loop. Symptoms:
- Save Template button click sometimes lands on a stale closure (toast fires "Template updated" — visible in your screenshot — but the navigation occurs while the parent is re‑rendering, so the list looks unchanged).
- Cancel / Back arrow appear unresponsive on first click during the render storm.
- After save we `navigate('/fitness/templates')` but **do not** `queryClient.invalidateQueries(['fitness-templates'])` or `['fitness-template-usage']`, so the templates list shows the old name/content until a hard refresh.

Other `/fitness/*` button issues found while auditing:
- `Templates.tsx` Download button calls the legacy `generatePlanPDF` (point 1).
- `Templates.tsx` Edit (`Pencil`) and "Use as starting point" (`FilePlus`) both navigate to `/fitness/create/manual?...` — these work, but the same render‑loop above makes the resulting page jittery.
- `PreviewPlan.tsx` "Save as template" does not invalidate `['fitness-templates']` consistently (it does, but `['fitness-template-usage']` is missed). Back button uses `editPath` which silently falls back to `/fitness/create` if the draft is missing.
- `CreateFlowLayout` back button uses `backTo` first, falling back to `navigate(-1)` only when neither prop is set — the `Cancel` button in CreateManual ignores history entirely and hard‑navigates to `/fitness/templates`, which loses the user's place when they entered from `MemberPlans`.
- No `onPopState` / unsaved‑changes guard on the editors → browser back silently discards edits.

---

## Plan

### A. Unify the fitness PDF pipeline (so designed PDF == downloaded PDF)

1. **Re‑point all fitness PDF entry points at `buildPlanPdf` from `pdfBlob.ts`.**
   - `Templates.tsx`: replace both `generatePlanPDF(...)` calls (card Download and `PlanViewerSheet onDownload`) with `buildPlanPdf({ planName, type, content }).then(blob => downloadBlob(blob, '...pdf'))`. Use brand context via `useBrandContext()` so the PDF is branded.
   - `PlanViewerSheet`: same swap.
   - Anywhere else under `src/pages/fitness/*` or `src/components/fitness/*` that still calls `generatePlanPDF` for plan downloads.
2. **Delete the fitness branch of `pdfGenerator.ts`** (`generatePlanPDF`). Keep the contract / payslip helpers if they are still used by HRM/Invoices, or migrate those too in a follow‑up. Add a deprecation comment at the top of `pdfGenerator.ts` listing what is left.
3. **Single shared download helper** `downloadPlanPdf(plan, brand)` in `src/utils/sendPlanToMember.ts` (or a sibling `planPdf.ts`) so Templates, PlanViewer, MemberPlans and AssignPlanDrawer all share one path. Filename uses the same `planFilename()` helper already in `sendPlanToMember.ts`.

### B. Fix the editor render loop (kills the button responsiveness)

In `ManualWorkoutEditor.tsx` and `ManualDietEditor.tsx`:

1. Wrap `handleSaveTemplate`, `handlePreview` in `useCallback` with the real deps (planName, description, difficulty, goal, content, templateId, draftId, member).
2. Memoize the meta object:
   ```ts
   const submit = useMemo(() => editMode ? handleSaveTemplate : handlePreview, [editMode, handleSaveTemplate, handlePreview]);
   const primaryLabel = useMemo(() => editMode ? 'Save Template' : draftId ? 'Save & Back to Preview' : 'Continue to Preview', [editMode, draftId]);
   useEffect(() => { onMetaChange?.({ canSubmit, submit, primaryLabel }); }, [canSubmit, submit, primaryLabel]);
   ```
3. After successful template save, `queryClient.invalidateQueries({ queryKey: ['fitness-templates'] })` and `['fitness-template-usage']` before `navigate('/fitness/templates')`.

### C. Tighten Cancel / Back semantics across the flow

1. `CreateManual.tsx` **Cancel** in editMode: use `navigate(-1)` if `history.length > 1` else `navigate('/fitness/templates')`. Same for the back arrow when `backTo` would lose context.
2. Confirm‑on‑leave guard: when `meta.canSubmit && dirty`, intercept Back/Cancel with a small `AlertDialog` ("Discard changes?") in `CreateFlowLayout`. Track `dirty` via a new `meta.dirty` flag pushed up the same way as `canSubmit`.
3. `PreviewPlan.tsx` "Save as template": also invalidate `['fitness-template-usage']` and keep current toast/disabled state.
4. `Templates.tsx` action buttons: keep Assign / Eye / Edit / Use‑as‑starting‑point / Targeting / Delete unchanged in behaviour, but route Download through the unified helper from A.

### D. Quick wins also surfaced in the audit (small, no behaviour change)

- `pdfGenerator.ts` is 918 lines and still ships in every fitness bundle even though only `generatePlanPDF` is used there — removing the import shrinks the templates page bundle.
- `usageCounts` query key uses an array of ids — switch to a stable hash so the cache survives re‑orders.
- `EditTemplateTargetingDrawer` save path already invalidates queries; mirror that pattern in editor save (point B.3).

### Files to touch

```text
src/utils/pdfGenerator.ts              # remove generatePlanPDF (or stub + warn)
src/utils/sendPlanToMember.ts          # export downloadPlanPdf helper
src/pages/fitness/Templates.tsx        # swap PDF calls + invalidate queries
src/pages/fitness/CreateManual.tsx     # smarter Cancel/back, dirty guard wiring
src/pages/fitness/PreviewPlan.tsx      # invalidate template-usage on save
src/components/fitness/PlanViewerSheet.tsx           # swap PDF call
src/components/fitness/create/CreateFlowLayout.tsx   # discard-changes dialog
src/components/fitness/create/manual/ManualWorkoutEditor.tsx  # memoize submit, invalidate
src/components/fitness/create/manual/ManualDietEditor.tsx     # same
```

No DB migration, no edge function change, no new dependencies.

### Out of scope (call out, don't build now)

- Migrating HRM payslip / InvoiceViewDrawer off `pdfGenerator.ts` — separate audit, since they rely on the print‑dialog UX.
- Real‑time sync for the Templates list (already covered by the previous realtime pass) — only the missing invalidations are added here.
