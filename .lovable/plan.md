## Audit Findings

### 1. Logo preload warning
`index.html` line 12 preloads `/incline-logo.png` with `fetchpriority="high"`. But:
- `AuthVisualPanel.tsx` imports the logo as a hashed Vite asset (`@/assets/incline-logo.png`), not the public path.
- `InclineAscent.tsx` is the only consumer of `/incline-logo.png`, and it's a route-specific lazy page.
- On every other route (including `/`, `/register`, `/auth`) the preload is never used → browser warning.

**Fix:** Remove the global `<link rel="preload">` for the logo from `index.html`. The `InclineAscent` page can self-preload via its own `<link>` injected on mount if needed.

### 2. Health-question mismatch (Public vs Staff registration)

| Field | Public `/register` (`PublicRegistration.tsx`) | Staff drawer (`MemberRegistrationForm.tsx`) |
|---|---|---|
| **PAR-Q (7 questions)** | Yes — saved to `member_onboarding_signatures.par_q` | **Missing entirely** |
| **Fitness goal** | Chip picker (4 primary + 2 more) → `members.fitness_goals` | Free-text textarea |
| **Health conditions** | 14-option chip multi-select + "Other" → `members.health_conditions` | Free-text textarea |
| **Consents (DPDP / WhatsApp / Photo / Waiver)** | 4 explicit checkboxes | Not captured |
| **Signed waiver PDF** | Auto-generated to `member-onboarding` bucket | Separate `registration_form` PDF to `documents` bucket |

The staff form doesn't surface PAR-Q answers already submitted online, and goals/conditions are typed free-text vs. structured chips → data drift.

### 3. Sync gap
- Public flow writes structured strings (`"Diabetes, Hypertension"`) into `members.health_conditions`.
- Staff drawer overwrites it with free-text. No round-trip read of existing chip selection.
- PAR-Q stored in `member_onboarding_signatures` is not displayed in staff registration drawer or `MemberProfile`.

---

## Plan

### A. Logo preload (1 file)
- `index.html` — delete the `<link rel="preload" as="image" href="/incline-logo.png" …>` line.

### B. Unify health/goals UI in staff Member Registration drawer
Refactor `src/components/members/MemberRegistrationForm.tsx`:
1. Extract the chip option arrays (`PRIMARY_GOALS`, `MORE_GOALS`, `HEALTH_CONDITION_OPTIONS`, `PARQ_QUESTIONS`) into a shared module: `src/lib/registration/healthQuestions.ts`.
2. Replace the free-text "Fitness Goals" textarea with the same chip picker used in `PublicRegistration`.
3. Replace the free-text "Medical Conditions" textarea with the same multi-chip picker + "Other" input.
4. Add a PAR-Q section (7 yes/no rows) above the signature pad — pre-filled from `member_onboarding_signatures.par_q` when present, editable by staff.
5. On save:
   - Write structured `members.fitness_goals` / `members.health_conditions` (same comma-joined format the public flow uses).
   - Upsert PAR-Q answers into `member_onboarding_signatures` (or insert a `manual` source row if member registered offline).
6. Update the generated PDF (`buildRegistrationFormPdf`) to render the PAR-Q table.

### C. Use shared arrays in PublicRegistration
- Replace inline arrays in `src/pages/PublicRegistration.tsx` with imports from `src/lib/registration/healthQuestions.ts` so the two forms stay in lock-step forever.

### D. Display existing answers in MemberProfile (read-only)
- Add a small "Health & Fitness" card to `src/pages/MemberProfile.tsx` showing parsed `health_conditions`, `fitness_goals`, and PAR-Q summary (count of "yes" answers + link to view full waiver PDF). No edit — edits go through the staff drawer.

### E. Verification
- Open staff drawer for a member who registered via `/register` → confirm chips reflect their saved choices and PAR-Q rows are pre-checked.
- Submit a new staff registration → confirm DB rows match the public-flow shape (no free-text drift).
- Reload `/register` and `/` → confirm no preload warning in console.

### Files touched
- `index.html` (1 line removed)
- `src/lib/registration/healthQuestions.ts` (new — shared constants)
- `src/components/members/MemberRegistrationForm.tsx` (chip pickers + PAR-Q section + PDF update)
- `src/pages/PublicRegistration.tsx` (import shared constants)
- `src/pages/MemberProfile.tsx` (read-only Health & Fitness card)

No DB migration needed — schema already supports both flows (`members.fitness_goals`, `members.health_conditions`, `member_onboarding_signatures.par_q`).
