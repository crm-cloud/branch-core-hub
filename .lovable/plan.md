## Goal
Pre-fill the Member Registration Form with data already collected on the member profile so staff don't retype:
- Fitness Goals → from `members.fitness_goals`
- Medical Conditions / Injuries → from `members.health_conditions` (fallback `injuries_limitations`)
- Government ID Type + Number → from `profiles.government_id_type` / `government_id_number`

Custom Terms stays a free input (it's literally meant to be optional / per-member).

## Changes

### 1. `src/components/members/MemberRegistrationForm.tsx`
Extend `RegistrationFormData` with optional pre-fill fields:
```ts
fitnessGoals?: string;
medicalConditions?: string;
governmentIdType?: string;   // 'aadhaar' | 'pan' | 'passport' | 'voter_id' | 'driving_license' | 'other'
governmentIdNumber?: string;
```

Initialize `useState` from props, and **re-sync when the drawer opens** so re-opening on a different member updates correctly:
```ts
const [govIdType, setGovIdType] = useState(data.governmentIdType || 'aadhaar');
const [govIdNumber, setGovIdNumber] = useState(data.governmentIdNumber || '');
const [fitnessGoals, setFitnessGoals] = useState(data.fitnessGoals || '');
const [medicalConditions, setMedicalConditions] = useState(data.medicalConditions || '');

useEffect(() => {
  if (!open) return;
  setGovIdType(data.governmentIdType || 'aadhaar');
  setGovIdNumber(data.governmentIdNumber || '');
  setFitnessGoals(data.fitnessGoals || '');
  setMedicalConditions(data.medicalConditions || '');
}, [open, data.memberId]);
```

Add a small "Pre-filled from profile" hint chip above each pre-populated field when the value came from props, so staff know it's editable.

### 2. `src/components/members/MemberProfileDrawer.tsx` (~line 1961)
Pass the new props through:
```tsx
fitnessGoals: (member as any).fitness_goals,
medicalConditions: (member as any).health_conditions || (member as any).injuries_limitations,
governmentIdType: (profile as any)?.government_id_type,
governmentIdNumber: (profile as any)?.government_id_number,
```

(Both `member` and `profile` are already in scope and queried; no extra fetches.)

### 3. On Save — write back any edits
In the existing save handler that persists registration form data, also update `members` and `profiles` so the canonical record stays in sync when staff corrects a value at registration time:
- `members`: `fitness_goals`, `health_conditions`
- `profiles`: `government_id_type`, `government_id_number`

(Only update fields whose value actually changed, to avoid noisy audit log entries.)

## Out of scope
- No schema changes — all columns already exist.
- Custom Terms field stays free-form; the 10 standard terms continue to be appended automatically.
- No changes to the signature canvas or PDF layout.

## Files
- `src/components/members/MemberRegistrationForm.tsx`
- `src/components/members/MemberProfileDrawer.tsx`
