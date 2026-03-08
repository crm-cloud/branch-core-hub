

# Implementation Plan: PT Analytics, Template Sync, Communication Logs

## 1. PT Analytics — Top Performer + Package Type Donut + Revenue by Trainer

**File: `src/pages/PTSessions.tsx`**

**Add imports:** `Crown`, `IndianRupee` from lucide-react

**Replace the Charts Row (lines 194-224)** with a 3-widget grid:

### Widget A: Top Performer Card
- Group `activePackages` by `trainer_id` → sum `price_paid` per trainer, count clients
- Find the trainer with highest total revenue
- Render a hero-style card with gold gradient, crown icon, trainer name, client count, total revenue

### Widget B: Package Type Split (Donut)
- Split `activePackages` into session-based (`sessions_total > 0`) vs duration-based (`sessions_total === 0`)
- Render a `PieChart` donut with 2 segments + total in center label

### Widget C: Revenue by Trainer (Horizontal Bar)
- Group `activePackages` by `trainer_id` → sum `price_paid`
- Map to trainer names from `trainers` array
- Render a `BarChart` with `layout="vertical"`, formatted ₹ values on XAxis

**Add computed data above return:**
```ts
const trainerRevenue = useMemo(() => {
  const map = new Map<string, { name: string; revenue: number; clients: number }>();
  activePackages?.forEach(pkg => {
    const id = pkg.trainer_id || 'unknown';
    const existing = map.get(id) || { name: pkg.trainer_name || 'Unassigned', revenue: 0, clients: 0 };
    existing.revenue += pkg.price_paid || 0;
    existing.clients += 1;
    map.set(id, existing);
  });
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}, [activePackages]);

const topPerformer = trainerRevenue[0];
const packageTypeSplit = [
  { name: 'Session-Based', value: activePackages?.filter(p => p.sessions_total > 0).length || 0 },
  { name: 'Duration-Based', value: activePackages?.filter(p => p.sessions_total === 0).length || 0 },
].filter(d => d.value > 0);
```

## 2. Template Sync — Announcements Uses DB Templates

**File: `src/pages/Announcements.tsx`**

**Changes:**
- Add `useQuery` for DB templates: `queryKey: ['db-templates'], queryFn: () => communicationService.fetchTemplates()`
- In the Templates sheet (lines 119-141), prioritize DB templates; if none exist, fall back to hardcoded `getTemplatesByType`
- DB templates have `type` field matching `sms`/`email`/`whatsapp` — filter the same way
- Show DB template `name`, `content`, and `trigger` as badge instead of `category`

**Template rendering logic:**
```tsx
const dbTemplatesForType = dbTemplates?.filter(t => t.type === type && t.is_active) || [];
const fallbackTemplates = dbTemplatesForType.length > 0 ? [] : getTemplatesByType(type);
// Render dbTemplatesForType first, then fallbackTemplates with a "Default" badge
```

## 3. Communication Logs — Record WhatsApp/SMS Opens

**File: `src/services/communicationService.ts`**

**Changes to `sendWhatsApp` (line 88):**
- Make it `async`, add optional `options?: { branchId?: string; memberId?: string }` param
- After `window.open`, call `this.logCommunication(...)` with type `'whatsapp'`, status `'sent'`
- Wrap in try/catch so logging failure doesn't break the UX

**Changes to `sendSMS` (line 113):**
- Same pattern: make `async`, add `options` param, log after opening

**Callers that need `branchId` passed:**
- `InvoiceShareDrawer.tsx` — already has invoice data, add branchId prop or derive from invoice
- `SendPaymentLinkDrawer.tsx` — already has invoice context
- `MemberProfileDrawer.tsx` — has member's branch_id
- These callers currently call `communicationService.sendWhatsApp(phone, msg)` — add optional 3rd arg `{ branchId }`

## Files to Change

| File | Change |
|------|--------|
| `src/pages/PTSessions.tsx` | Add `useMemo` import, add `Crown`/`IndianRupee` icons, replace chart row with 3 analytics widgets |
| `src/pages/Announcements.tsx` | Add DB template query, update template sheet to show DB templates with hardcoded fallback |
| `src/services/communicationService.ts` | Make `sendWhatsApp`/`sendSMS` async with logging |
| `src/components/invoices/InvoiceShareDrawer.tsx` | Pass `branchId` to `sendWhatsApp`/`sendSMS` calls |
| `src/components/invoices/SendPaymentLinkDrawer.tsx` | Pass `branchId` to `sendWhatsApp` calls |

## Execution Order
1. Communication service logging fix (foundation)
2. Announcements template sync
3. PT analytics widgets

