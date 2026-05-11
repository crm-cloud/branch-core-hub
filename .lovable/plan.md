
## 1. Equipment — Better strategy than blind deduplication

### The problem with merging duplicates
Each treadmill / bench is a **physical asset** with its own:
- Serial number, purchase date, warranty
- Maintenance history (one treadmill might be broken, the others fine)
- Status (operational / maintenance / out-of-order)
- QR code for member check-in / fault reporting

If we collapse "Treadmill ×4" into one row with `quantity=4`, we lose **per-unit maintenance tracking, per-unit status, and per-unit warranty** — which defeats the purpose of an equipment register.

### Recommended approach (keep granularity, fix the noise)

**A. Keep one row per physical unit** (no destructive merge).

**B. Add an auto-numbered display name** so the list reads cleanly:
- Show as `Treadmill #1, Treadmill #2, Treadmill #3, Treadmill #4` in the table
- Computed client-side from `name + row_number() over (partition by name)` — no schema change
- AI prompt for plan generation already de-dupes by name, so this stays correct

**C. Add a "Group by model" toggle** on the All Equipment tab:
- Default: flat list
- Grouped: one card per name showing `4 units · 3 operational · 1 in maintenance` with expandable sub-rows
- Pure UI — no DB change

**D. Add Delete + Bulk actions** (currently missing):
- Per-row `Delete` in the actions column (soft-delete via `status='retired'` is already supported; add a true delete with confirm dialog for owners only)
- Row checkboxes + bulk bar: Set Status / Delete (owner only)
- New `deleteEquipment(id)` in `equipmentService.ts` with FK-safe handling (block delete if maintenance records exist → suggest "Retire" instead)

**E. (Optional, future) Asset tag column** — short code like `TRD-01` printed on the QR sticker so staff know exactly which unit needs service.

### Why this is better than `quantity`
| Concern | `quantity` field | One row per unit (recommended) |
|---|---|---|
| Maintenance per unit | ❌ Lost | ✅ Preserved |
| Per-unit status | ❌ Lost | ✅ Preserved |
| Warranty/serial tracking | ❌ Lost | ✅ Preserved |
| Cleaner list | ✅ | ✅ (via group toggle) |
| AI plan generator correctness | ✅ | ✅ (already de-dupes by name) |

---

## 2. RBAC — Hide Purchase Price from Staff & Manager

**Rule:** Purchase price + total asset value = **Owner only** (financial data).

Changes in `EquipmentMaintenance.tsx` + `AddEquipmentDrawer.tsx`:
- Wrap the `Purchase Price` table column, the `Purchase Price` form field, and the `Total Value` KPI tile with `can.viewFinancials(roles)` (owner-only capability)
- Manager/Staff see the table without that column; the KPI row collapses gracefully
- The `purchase_price` column is also masked at the API layer for non-owners (RLS check via `has_capability('view_equipment_cost')`) — defence in depth

This matches the existing pattern documented in `mem://architecture/p4-app-layer-hardening` (capability-based access via `can.X`).

---

## 3. Workout & Diet PDFs — premium redesign

The current PDFs (in `src/utils/pdfGenerator.ts`) are plain HTML with an indigo accent — not on-brand and not visually engaging. Reference images show bold typographic headers, day-grid cards, motivational hero blocks, and a footer band.

### New design language (matches Incline brand, inspired by uploaded references)

**Cover/Header band**
- Full-width dark hero: `#0F172A` background, Incline logo (top-left, from `public/incline-logo.png` or branch logo via `useBrandContext`)
- Big display title: **"YOUR 7-DAY WORKOUT PLAN"** / **"YOUR PERSONALIZED DIET PLAN"** in Inter Black, white, with an orange/violet accent bar
- Sub-line: member name · plan duration · trainer name (if assigned)

**Motivational quote strip** (just under hero)
- Italic pull-quote in a soft gradient band (violet→indigo for workout, emerald→teal for diet)
- Rotating pool of ~10 curated quotes per type, picked deterministically from `plan.id` so the same plan always shows the same quote

**Body — Workout**
- Day cards in a 2-column grid (Mon–Sun), each card:
  - Bold day label on a dark chip (matches reference image #1)
  - Mini table: `EXERCISE · SETS · REPS · REST` with zebra rows
  - Equipment name only (no brand/model — already enforced by `generate-fitness-plan` v1.1.0)
- Section header bars with the orange accent line (reference #1)

**Body — Diet**
- Daily calorie target chip + macro split (P / C / F) bar
- Meal cards (Breakfast, Mid-Morning, Lunch, Snack, Dinner) with portion + kcal
- Hydration & supplements row at the end

**Do's and Don'ts panel** (both PDF types)
- Two side-by-side cards on the last content page:
  - ✅ **DO** — green tint, list of 6 items (warm up, hydrate, log progress, sleep 7-8h, progressive overload, ask trainer)
  - ⛔ **DON'T** — red tint, list of 6 items (skip warm-up, ego-lift, train through sharp pain, crash diet, etc.)
- Diet variant gets diet-specific items (don't skip meals, avoid late-night carbs, etc.)

**Pro Tips strip**
- 3-tip horizontal card row with lucide-style icons rendered as inline SVG
- Workout tips: form > weight, track sessions, deload weekly
- Diet tips: prep meals Sunday, eat protein at every meal, sleep matters

**Footer band**
- Dark band with: Incline logo + "The Incline Life by Incline" (legal name per brand memory) · branch address · contact · plan generated date
- Page number + "Personalized for {member_name}" watermark

### Implementation
- Refactor `generatePlanPDF` in `src/utils/pdfGenerator.ts`:
  - Split into `renderWorkoutPdfHtml(plan, brand)` and `renderDietPdfHtml(plan, brand)`
  - New shared partials: `renderHero`, `renderQuoteStrip`, `renderDosAndDonts`, `renderTipsStrip`, `renderFooter`
  - Pull `brand.logoUrl` + `brand.companyName` from `useBrandContext` (caller passes it in — keeps the util pure)
  - Inline base64 fallback for the default logo so the PDF renders even when the user prints without internet
- New module `src/utils/pdfContent.ts`:
  - `WORKOUT_QUOTES`, `DIET_QUOTES`, `WORKOUT_DOS`, `WORKOUT_DONTS`, `DIET_DOS`, `DIET_DONTS`, `WORKOUT_TIPS`, `DIET_TIPS`
- Print stylesheet tuned for A4, page-break-inside: avoid on every card, hero only on first page

### Files touched
- `src/utils/pdfGenerator.ts` — full rewrite of plan PDF section (contract PDF untouched)
- `src/utils/pdfContent.ts` — new (quotes / dos / donts / tips)
- `src/pages/MyWorkout.tsx`, `src/pages/MyDiet.tsx`, `src/utils/sendPlanToMember.ts` — pass brand context into `generatePlanPDF`
- `src/services/equipmentService.ts` — add `deleteEquipment`, capability-aware `fetchEquipment` projection
- `src/pages/EquipmentMaintenance.tsx` — auto-numbered display names, group-by-name toggle, delete + bulk actions, hide price column for non-owners
- `src/components/equipment/AddEquipmentDrawer.tsx` — hide Purchase Price field for non-owners
- `supabase/migrations/<new>.sql` — `view_equipment_cost` capability + grant to owner role; RLS column-level guard via SECURITY DEFINER view (optional, defence-in-depth)

### QA
- Generate one workout + one diet PDF, render to images via the pdf skill, inspect for: overflow, missing logo, broken page breaks, contrast.
- Manually test as Staff and Manager logins: confirm Purchase Price column + field + Total Value tile are absent.
- Test delete flow: with maintenance records present (should block + offer Retire), without (should hard-delete).

### Open question
Do you want a single delete action (hard delete + cascade maintenance), or **soft-retire by default + hard-delete only when no history exists**? I recommend the latter — it preserves the audit trail.
