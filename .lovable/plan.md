

# Fix: 400 Bad Request Errors on plan_benefits and benefit_settings

## Root Cause

Both `plan_benefits` and `benefit_settings` tables have a `benefit_type` column typed as a database enum (`benefit_type`). The valid enum values are: `gym_access`, `pool_access`, `sauna_access`, `steam_access`, `group_classes`, `pt_sessions`, `locker`, `towel`, `parking`, `guest_pass`, `other`, `ice_bath`, `yoga_class`, `crossfit_class`, `spa_access`, `sauna_session`, `cardio_area`, `functional_training`.

However, custom benefit types created in Settings have their own codes (e.g., `ice_bath_access`) which do NOT exist in this enum. When the code tries to insert these codes into the enum column, PostgREST rejects it with a 400.

**Error 1 -- plan_benefits insert (AddPlanDrawer.tsx line 115):**
```typescript
benefit_type: b.code as any  // b.code = "ice_bath_access" -- NOT in enum!
```

**Error 2 -- benefit_settings upsert (BenefitSettingsComponent.tsx line 68):**
```typescript
benefit_type: benefitType  // benefitType comes from bt.code cast as BenefitType -- NOT in enum!
```

## Fix

In both places, check if the custom benefit type code matches a known enum value. If not, use `'other'` as a safe fallback. The actual linkage is maintained via `benefit_type_id` (UUID foreign key).

---

### File 1: `src/components/plans/AddPlanDrawer.tsx`

**Change (line 113-119):** Add a helper to map custom codes to valid enum values, using `'other'` as fallback.

```typescript
// Add a set of known enum values
const KNOWN_BENEFIT_ENUMS = new Set([
  'gym_access','pool_access','sauna_access','steam_access','group_classes',
  'pt_sessions','locker','towel','parking','guest_pass','other','ice_bath',
  'yoga_class','crossfit_class','spa_access','sauna_session','cardio_area','functional_training'
]);

// In benefitsToInsert mapping:
benefit_type: (KNOWN_BENEFIT_ENUMS.has(b.code) ? b.code : 'other') as any,
```

### File 2: `src/components/settings/BenefitSettingsComponent.tsx`

**Change (line 300):** Same enum validation when passing `benefitType` to the form.

```typescript
benefitType={KNOWN_BENEFIT_ENUMS.has(bt.code) ? (bt.code as BenefitType) : ('other' as BenefitType)}
```

### File 3: `src/services/benefitBookingService.ts`

**Change (line 114):** Ensure the insert fallback also validates against known enums.

```typescript
const insertData = { 
  ...setting, 
  benefit_type: (KNOWN_BENEFIT_ENUMS.has(setting.benefit_type) ? setting.benefit_type : 'other') as BenefitType 
};
```

---

## Summary

| File | Change |
|------|--------|
| `src/components/plans/AddPlanDrawer.tsx` | Map unknown benefit codes to `'other'` enum value in plan_benefits insert |
| `src/components/settings/BenefitSettingsComponent.tsx` | Pass `'other'` as fallback enum when benefit code is custom |
| `src/services/benefitBookingService.ts` | Validate enum value before insert, fallback to `'other'` |

All three files get the same `KNOWN_BENEFIT_ENUMS` set (or a shared constant) to validate codes against. The `benefit_type_id` UUID column handles the actual reference -- the enum column is kept for backward compatibility only.
