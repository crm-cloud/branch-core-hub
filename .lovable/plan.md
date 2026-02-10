

# Fix: POS Invoice Duplicate Key Error & Inventory 406 Error

## Root Cause Analysis

### Bug 1: Invoice 409 Conflict (Duplicate Key)
The database trigger `generate_invoice_number_trigger` only fires when `invoice_number IS NULL`:
```
WHEN ((new.invoice_number IS NULL))
```
But the code in `storeService.ts` (line 120) and `billingService.ts` (line 62) inserts `invoice_number: ''` (empty string). Since `''` is NOT NULL, the trigger never fires, and the empty string violates the unique constraint on the second insert.

There is already one invoice with `invoice_number = ''` stuck in the database.

### Bug 2: Inventory 406 (Not Acceptable)
The `inventory` table has **0 rows**. When `storeService.ts` calls `.single()` on an empty result, Supabase returns 406. This also means POS stock deduction silently fails for every sale.

---

## Fix Plan

### 1. Fix invoice insertion code (2 files)

**`src/services/storeService.ts` line 120:**
Change `invoice_number: ''` to `invoice_number: null`

**`src/services/billingService.ts` line 62:**
Change `invoice_number: ''` to `invoice_number: null`

This ensures the database trigger fires and auto-generates the sequential invoice number.

### 2. Fix the stuck empty invoice number in the database

Run a migration to update the existing broken record:
```sql
UPDATE invoices SET invoice_number = NULL WHERE invoice_number = '';
```

Also update the trigger to handle both NULL and empty string for safety:
```sql
DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON invoices;
CREATE TRIGGER generate_invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();
```

### 3. Fix inventory 406 error

**`src/services/storeService.ts` line 168-173:**
Change `.single()` to `.maybeSingle()` so that when no inventory record exists, it returns `null` instead of throwing a 406 error.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/services/storeService.ts` | Line 120: `''` to `null`; Line 173: `.single()` to `.maybeSingle()` |
| `src/services/billingService.ts` | Line 62: `''` to `null` |
| Database migration | Fix stuck record + update trigger condition |

## Technical Details

### storeService.ts changes
```typescript
// Line 120: Change
invoice_number: '',
// To:
invoice_number: null,

// Line 173: Change
.single();
// To:
.maybeSingle();
```

### billingService.ts changes
```typescript
// Line 62: Change
invoice_number: '',
// To:
invoice_number: null,
```

### Database migration
```sql
-- Fix existing broken invoice
UPDATE invoices SET invoice_number = NULL WHERE invoice_number = '';

-- Make trigger fire on both NULL and empty string
DROP TRIGGER IF EXISTS generate_invoice_number_trigger ON invoices;
CREATE TRIGGER generate_invoice_number_trigger
  BEFORE INSERT ON invoices
  FOR EACH ROW
  WHEN (NEW.invoice_number IS NULL OR NEW.invoice_number = '')
  EXECUTE FUNCTION generate_invoice_number();
```

