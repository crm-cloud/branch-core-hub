

# Plan: Income & Expense Categories with Default Seeding

## Current State
- **Expense categories** exist in the `expense_categories` table and are managed via `ExpenseCategoryManager` in Settings.
- **Income has no categorization** — payments are only tagged by `invoice_type` (membership, pt_package, etc.) on the invoice, with no dedicated income category system.
- An unused `expense_category_templates` table exists with a `type` column — we can repurpose the concept but it's cleaner to build a unified `finance_categories` table.

## Approach

Rather than separate tables for income/expense categories, create a single **`finance_categories`** table with a `type` column (`income` or `expense`). Migrate existing `expense_categories` data into it, then update all references. Seed with defaults for both types.

### Default Income Categories
- Membership Fees
- PT Packages
- Class Fees
- Store / POS Sales
- Registration / Joining Fee
- Locker Rental
- Add-on Services
- Referral Income
- Other Income

### Default Expense Categories
- Rent & Lease
- Salaries & Wages
- Utilities (Electricity, Water, Internet)
- Equipment Purchase
- Equipment Maintenance
- Marketing & Advertising
- Cleaning & Housekeeping
- Insurance
- Trainer Commissions
- Software & Subscriptions
- Office Supplies
- Repairs & Maintenance
- Miscellaneous

## Database Changes

**Migration:**
1. Create `finance_categories` table: `id UUID PK, name TEXT, type TEXT ('income'|'expense'), description TEXT, icon TEXT, color TEXT, is_active BOOLEAN DEFAULT true, is_system BOOLEAN DEFAULT false, branch_id UUID NULL (null = global), created_at TIMESTAMPTZ`
2. Enable RLS with policy for authenticated users to read all, and owner/admin/staff to insert/update.
3. Seed default categories with `is_system = true`.
4. Add `income_category_id UUID REFERENCES finance_categories(id)` to `payments` table.
5. Add `expense_category_id UUID REFERENCES finance_categories(id)` to `expenses` table (keep existing `category_id` for backward compat, but new UI uses this).

**On second thought** — simpler approach: just add an `income_categories` table mirroring `expense_categories`, seed both tables with defaults, and link income categories to payments. This avoids breaking existing expense flows.

**Simplest approach chosen:**
1. Create `income_categories` table (mirrors `expense_categories` structure: `id, name, description, is_active, is_system, created_at`)
2. Seed `income_categories` with defaults
3. Seed `expense_categories` with defaults (if empty)
4. Add `income_category_id` column to `payments` table (nullable FK)

## Code Changes

| File | Change |
|------|--------|
| `src/components/settings/ExpenseCategoryManager.tsx` | Rename to `FinanceCategoryManager.tsx`. Add tabs for Income / Expense categories, managing both tables. |
| `src/pages/Settings.tsx` | Update import and menu label from "Expenses" → "Finance Categories" |
| `src/components/finance/AddExpenseDrawer.tsx` | No change needed (still uses `expense_categories`) |
| `src/pages/Finance.tsx` | Show income category on income rows; add income category filter |
| `src/components/invoices/RecordPaymentDrawer.tsx` | Add optional income category selector |
| **DB Migration** | Create `income_categories` table + seed defaults for both tables + add `income_category_id` to `payments` |

## UI Design

The Settings page "Finance Categories" section will have two tabs:
- **Income Categories** tab — table with add/edit/toggle, same UI pattern as current expense categories
- **Expense Categories** tab — existing functionality preserved

Both show colored badge for Active/Inactive, edit (pencil) and toggle (status) actions.

