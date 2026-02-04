

# Comprehensive Gym Management Enhancement Plan
## Finance, AI Fitness, Inventory, and Audit Logs

---

## Executive Summary

This plan addresses 4 major feature areas based on comprehensive audit:

| Area | Current Status | Gap |
|------|---------------|-----|
| Finance & Expense Manager | Partial - expenses table exists, Finance page shows expenses | **Missing:** Expense entry form, receipt upload, category management UI |
| AI Fitness & Workout Engine | Partial - AI generation works, templates exist | **Missing:** Exercise database, workout shuffler/randomizer, PDF branding |
| Store & Inventory Sync | Partial - POS deducts inventory | **Missing:** Initial quantity field in product form, low stock alerts in POS |
| Audit Logs | Working - shows raw data | **Missing:** Human-readable descriptions, actor names instead of UUIDs |

---

## Part 1: Unified Finance & Expense Manager

### Current State
- `expenses` table exists with: `amount`, `description`, `expense_date`, `vendor`, `receipt_url`, `category_id`, `status`
- `expense_categories` table exists (but has 0 categories seeded)
- `Finance.tsx` displays approved expenses and calculates net profit
- **No UI to add/submit expenses**
- **No expense categories seeded**

### Implementation Required

**1.1 Create AddExpenseDrawer Component**
Create `src/components/finance/AddExpenseDrawer.tsx`:

```text
Fields:
- Category (dropdown from expense_categories)
- Amount (number, required)
- Description (textarea, required)  
- Vendor (text, optional)
- Expense Date (date picker, default today)
- Receipt Upload (image upload to 'receipts' storage bucket)
- Submit for Approval (checkbox) - when checked, status='pending'
```

**1.2 Create Storage Bucket for Receipts**
Create `receipts` storage bucket (public: no, for internal expense documentation)

**1.3 Seed Default Expense Categories**
Insert into `expense_categories`:
- Utilities (Electricity, Water, Internet)
- Salaries
- Maintenance (Equipment, Building)
- Marketing (Ads, Promotions)
- Inventory Purchase
- Rent
- Insurance
- Miscellaneous

**1.4 Add Expense Management to Finance Page**
Modify `src/pages/Finance.tsx`:
- Add "Add Expense" button
- Add expense category CRUD in Settings
- Show pending vs approved expense tabs
- Add approval workflow for expenses (uses existing `approval_requests` flow)

**1.5 Export Enhancement**
Modify Finance page CSV export to include:
- All income transactions
- All expense transactions with category names
- Net profit calculation

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/components/finance/AddExpenseDrawer.tsx` | Create - expense entry form with receipt upload |
| `src/pages/Finance.tsx` | Modify - add expense button, approval tabs |
| `src/pages/Settings.tsx` | Modify - add Expense Categories tab |
| Database | Migration - create `receipts` bucket, seed expense categories |

---

## Part 2: AI Global Plan & Workout Engine

### Current State
- AI fitness generation via `generate-fitness-plan` edge function works
- `fitness_plan_templates` and `member_fitness_plans` tables exist
- PDF generation exists via `pdfGenerator.ts` (uses print window)
- Progress photos supported in `RecordMeasurementDrawer.tsx` via `member-photos` bucket
- `member_measurements.photos` column stores JSONB array of URLs
- **No `exercises` database table for workout shuffling**
- **No seeded shuffle/randomization logic**

### Implementation Required

**2.1 Create Exercises Database Table**
Create `exercises` table:

```sql
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_muscle TEXT NOT NULL, -- chest, back, legs, shoulders, arms, core, full_body
  equipment_type TEXT, -- barbell, dumbbell, machine, cable, bodyweight, cardio
  primary_equipment_id UUID REFERENCES equipment(id), -- optional link to gym equipment
  difficulty TEXT DEFAULT 'intermediate', -- beginner, intermediate, advanced
  instructions TEXT,
  video_url TEXT,
  image_url TEXT,
  calories_per_minute NUMERIC,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

Seed with 50+ common gym exercises across muscle groups.

**2.2 Create Workout Shuffler Service**
Create `src/services/workoutShufflerService.ts`:

```typescript
// Core logic:
// 1. Get member's target muscle group for today
// 2. Fetch exercises matching target
// 3. Create member+date seed: `${memberId}-${YYYY-MM-DD}`
// 4. Use seeded shuffle to randomize exercise order
// 5. Optional: Check equipment usage (from device_access_events) 
//    and deprioritize busy equipment
```

**2.3 Add Workout Randomizer to Member Portal**
Modify `src/pages/MyWorkout.tsx`:
- Add "Generate Today's Workout" button
- Use shuffler service to create unique daily routine
- Show exercises with "Mark as Done" buttons
- Track workout progress in new `member_workout_logs` table

**2.4 Enhance PDF Generator with Incline Branding**
Modify `src/utils/pdfGenerator.ts`:
- Add gym logo/branding header (fetch from organization settings)
- Add "4-Week Transformation" timeframe display
- Add macro/calorie targets in diet plans
- Improve print styling for professional appearance

**2.5 Global Plan Templates with Macros**
Add to Settings > AI Fitness:
- Macro/Micro targets builder (Protein g, Carbs g, Fats g, Fiber g)
- Meal image URL field in diet template content
- Default template assignment

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/workoutShufflerService.ts` | Create - seeded shuffle algorithm |
| `src/pages/MyWorkout.tsx` | Modify - add daily randomized workout feature |
| `src/utils/pdfGenerator.ts` | Modify - add branding, timeframe, macros |
| `src/pages/AIFitness.tsx` | Modify - add macro targets to diet templates |
| Database | Migration - create `exercises` table, seed data |

---

## Part 3: Store, Inventory & POS Alignment

### Current State
- `products` table exists (no initial quantity column - that's in `inventory` table)
- `inventory` table tracks per-branch product quantities
- `stock_movements` table logs all stock changes
- `storeService.ts` correctly deducts inventory on POS sale
- **AddProductDrawer.tsx does NOT have initial quantity field**
- **No automatic inventory record creation when product is created**
- **Products page shows 22 products but inventory is 0 (screenshot confirms)**

### The Core Problem
Products are created without inventory records. The `inventory` table is empty because:
1. Product creation doesn't auto-create inventory entry
2. No "Initial Quantity" field exists in AddProductDrawer
3. Admin must manually use stock movement service to add stock

### Implementation Required

**3.1 Add Initial Quantity to Product Form**
Modify `src/components/products/AddProductDrawer.tsx`:

```typescript
// Add to formData state:
initial_quantity: '',

// Add to form (after price fields):
<div className="space-y-2">
  <Label htmlFor="initial_quantity">Initial Stock Quantity *</Label>
  <Input
    id="initial_quantity"
    type="number"
    min="0"
    value={formData.initial_quantity}
    onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
    placeholder="50"
    required={!isEditing} // Required only for new products
  />
</div>
```

**3.2 Create Inventory Record on Product Creation**
Modify save mutation in `AddProductDrawer.tsx`:

```typescript
// After product is created successfully:
if (!isEditing && formData.initial_quantity) {
  const quantity = parseInt(formData.initial_quantity);
  
  // Get default branch if not specified
  const branchId = formData.branch_id || /* first branch or all-branches flag */;
  
  // Create inventory record
  await supabase.from('inventory').insert({
    product_id: newProduct.id,
    branch_id: branchId,
    quantity: quantity,
    min_quantity: 5, // Default low stock threshold
  });
  
  // Record initial stock movement
  await stockMovementService.recordMovement({
    product_id: newProduct.id,
    branch_id: branchId,
    movement_type: 'initial',
    quantity: quantity,
    notes: 'Initial stock on product creation',
  });
}
```

**3.3 Add Low Stock Warning to POS**
Modify `src/pages/POS.tsx`:
- After adding item to cart, check if remaining stock < min_quantity
- Show warning badge: "Low Stock - Only X left"
- Block sale if quantity > available stock

**3.4 Branch Filtering for Products**
The `storeService.ts` already supports branch filtering:
```typescript
query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
```
Verify this is correctly applied in POS and Store pages.

### Files to Modify

| File | Action |
|------|--------|
| `src/components/products/AddProductDrawer.tsx` | Modify - add initial quantity field, create inventory on save |
| `src/pages/POS.tsx` | Modify - add low stock warnings, quantity validation |
| `src/services/productService.ts` | Modify - add createProductWithInventory function |

---

## Part 4: Transparent Audit Logs & Human-Readable Descriptions

### Current State
- `audit_logs` table captures INSERT/UPDATE/DELETE via database trigger
- Shows: action, table_name, record_id (UUID), old_data, new_data
- **No actor_name stored (only user_id UUID)**
- **No human-readable action_description**
- AuditLogs.tsx shows truncated UUIDs, no names

### Implementation Required

**4.1 Add Human-Readable Columns to audit_logs**
Add database columns:

```sql
ALTER TABLE audit_logs 
ADD COLUMN actor_name TEXT,
ADD COLUMN action_description TEXT;
```

**4.2 Update Trigger to Capture Actor Name**
Modify `audit_log_trigger_function`:

```sql
-- Fetch actor name at time of log creation
SELECT full_name INTO actor_name_var 
FROM public.profiles 
WHERE id = auth.uid();

-- Generate human-readable description based on action and table
action_desc := CASE 
  WHEN TG_TABLE_NAME = 'members' AND TG_OP = 'UPDATE' THEN
    actor_name_var || ' updated member ' || NEW.member_code
  WHEN TG_TABLE_NAME = 'memberships' AND TG_OP = 'INSERT' THEN
    actor_name_var || ' created membership for member ' || ...
  -- ... more cases
  ELSE actor_name_var || ' ' || TG_OP || ' on ' || TG_TABLE_NAME
END;
```

**4.3 Enhance AuditLogs.tsx Display**
Modify `src/pages/AuditLogs.tsx`:

```typescript
// Instead of showing:
// "UPDATE | members | dc7742e5 | 4 days ago"

// Show:
// "Admin Rajat updated Member Kavita's profile | 4 days ago"

// Add human-friendly rendering:
const getHumanDescription = (log: any) => {
  if (log.action_description) return log.action_description;
  
  // Fallback: Parse old_data/new_data to extract meaningful names
  const actorName = log.profiles?.full_name || 'Unknown User';
  const recordName = log.new_data?.full_name || 
                     log.new_data?.name || 
                     log.new_data?.member_code ||
                     log.record_id?.substring(0, 8);
  
  return `${actorName} ${log.action.toLowerCase()}d ${log.table_name} "${recordName}"`;
};
```

**4.4 Add DialogTitle for Accessibility**
The current audit logs use Collapsible, not Dialog. If any dialogs are added, ensure DialogTitle is included.

### Files to Modify

| File | Action |
|------|--------|
| Database | Migration - add actor_name, action_description columns |
| Database | Update trigger function to populate new columns |
| `src/pages/AuditLogs.tsx` | Modify - display human-readable descriptions |

---

## Implementation Priority

| Phase | Tasks | Complexity |
|-------|-------|------------|
| **Phase 1** | Inventory Initial Quantity + Low Stock | Medium |
| **Phase 2** | Expense Entry Form + Categories | Medium |
| **Phase 3** | Human-Readable Audit Logs | Low-Medium |
| **Phase 4** | Exercises Table + Workout Shuffler | High |
| **Phase 5** | PDF Branding + Macro Targets | Low |

---

## Database Migrations Required

```sql
-- 1. Create receipts storage bucket (via Supabase dashboard)

-- 2. Seed expense categories
INSERT INTO expense_categories (name, description) VALUES
  ('Utilities', 'Electricity, Water, Internet'),
  ('Salaries', 'Staff and trainer salaries'),
  ('Maintenance', 'Equipment and building maintenance'),
  ('Marketing', 'Advertising and promotions'),
  ('Inventory Purchase', 'Product restocking'),
  ('Rent', 'Building lease payments'),
  ('Insurance', 'Business insurance'),
  ('Miscellaneous', 'Other expenses');

-- 3. Create exercises table
CREATE TABLE exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  target_muscle TEXT NOT NULL,
  equipment_type TEXT,
  difficulty TEXT DEFAULT 'intermediate',
  instructions TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Seed exercises (50+ rows)

-- 5. Add human-readable audit log columns
ALTER TABLE audit_logs 
ADD COLUMN IF NOT EXISTS actor_name TEXT,
ADD COLUMN IF NOT EXISTS action_description TEXT;
```

---

## Files Summary

### New Files (3)
| File | Description |
|------|-------------|
| `src/components/finance/AddExpenseDrawer.tsx` | Expense entry form with receipt upload |
| `src/services/workoutShufflerService.ts` | Seeded workout randomization engine |
| `src/components/settings/ExpenseCategoryManager.tsx` | CRUD for expense categories |

### Modified Files (7)
| File | Changes |
|------|---------|
| `src/pages/Finance.tsx` | Add expense button, pending/approved tabs |
| `src/pages/Settings.tsx` | Add Expense Categories tab |
| `src/components/products/AddProductDrawer.tsx` | Add initial quantity field + inventory creation |
| `src/pages/POS.tsx` | Add low stock warnings |
| `src/pages/MyWorkout.tsx` | Add daily randomized workout generation |
| `src/utils/pdfGenerator.ts` | Add Incline branding, macros |
| `src/pages/AuditLogs.tsx` | Display human-readable descriptions |

---

## Technical Notes

### Workout Shuffler Algorithm

```text
1. Input: memberId, targetMuscle (e.g., "chest")
2. Fetch exercises WHERE target_muscle = targetMuscle AND is_active = true
3. Create seed: hash(memberId + YYYY-MM-DD)
4. Initialize seeded random with seed
5. Shuffle exercise array using Fisher-Yates with seeded random
6. Optional: Query equipment usage from device_access_events in last 30 mins
7. Sort exercises to deprioritize equipment with high current usage
8. Return shuffled exercise list
```

### Expense Approval Flow

```text
Staff submits expense → status: 'pending' → approval_requests entry created
Manager reviews → Approve: status: 'approved' / Reject: status: 'rejected'  
Finance dashboard only shows 'approved' expenses in totals
```

### Inventory Creation Flow

```text
Admin creates product with initial quantity (e.g., 50)
→ Product inserted into `products` table
→ Inventory record created in `inventory` table (quantity: 50, branch_id)
→ Stock movement logged in `stock_movements` (type: 'initial', quantity: 50)
→ Product shows "50 in stock" on Products page
→ POS sale decrements inventory and logs 'sale' movement
```

