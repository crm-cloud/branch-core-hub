

# Sidebar Regrouping + Analytics POS/eCommerce Widgets

## Part 1: Sidebar Menu Regrouping

**File: `src/config/menu.ts`** -- Rearrange `adminMenuConfig` sections and items only. No items added or removed, just reordered.

New order:

| Section | Items (in order) |
|---------|-----------------|
| **Main** | Dashboard, Analytics |
| **Members & Leads** | Leads, Members, Attendance, Plans, Referrals, Feedback |
| **Training & Bookings** | Classes, PT Sessions, Trainers, All Bookings, Benefit Tracking, AI Fitness |
| **E-Commerce & Sales** | POS, Products, Categories, Store Orders |
| **Finance** | Overview, Invoices, Payments |
| **Operations & Comm** | WhatsApp Chat, Announcements, Equipment, Lockers, Devices |
| **Admin & HR** | HRM, Employees, Staff Attendance, Tasks, Approvals, Audit Logs, Settings |

Key moves:
- Analytics moves from "Administration" to "Main"
- Leads moves from "CRM & Engagement" up to "Members & Leads"
- Referrals moves from "CRM & Engagement" to "Members & Leads"
- All Bookings, Benefit Tracking move from "Operations" to "Training & Bookings"
- WhatsApp Chat, Announcements move from "CRM & Engagement" to "Operations & Comm"
- Tasks, Approvals move from "CRM & Engagement" to "Admin & HR"
- Sign Out remains at the bottom (handled by `AppSidebar.tsx`, not the menu config)

No changes needed to `AppSidebar.tsx` -- it already renders a Sign Out button at the bottom.

---

## Part 2: Analytics Page -- POS/eCommerce Widgets

**File: `src/pages/Analytics.tsx`** -- Add three new widgets after the existing charts.

### Widget A: "Earning Reports" (Weekly)
- Matches the Vuexy reference card exactly
- A `BarChart` showing daily earnings for the current week (Mon-Sun)
- Query: payments from current week grouped by day of week
- Below the chart: 3 summary rows with icons and trend percentages:
  - **Net Profit** (revenue - expenses) with green trend arrow
  - **Total Income** (total payments collected) with green trend arrow
  - **Total Expenses** (approved expenses) with orange trend arrow
- Each row shows: icon, label, subtitle, amount, and percentage change
- Card style: `rounded-2xl border-none shadow-lg shadow-indigo-100`

### Widget B: "Popular Products"
- Shows top-selling products by quantity sold
- Query: `invoice_items` grouped by `product_id`, joined with `products` table for name/price
- Displays a list with product name, item code/SKU, price, and units sold
- Subtitle: "Total X items sold"
- Card style matches Vuexy reference

### Widget C: "Recent Store Orders"
- Renamed from Vuexy's "Orders by Countries"
- Shows recent invoices that are POS/store sales
- Tabs: "New", "Processing", "Completed" (mapped to invoice statuses)
- Each row shows: status icon (colored dot), member name, amount, date
- Query: invoices with `invoice_type = 'pos_sale'` or store-related, ordered by date

### New queries needed:
```text
1. Weekly earnings: payments from startOfWeek to endOfWeek, grouped by day
2. Popular products: invoice_items joined with products, grouped, sorted by quantity DESC, LIMIT 5
3. Recent store orders: invoices where type is POS/store, with member info, LIMIT 10
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/config/menu.ts` | Rearrange `adminMenuConfig` sections and item order |
| `src/pages/Analytics.tsx` | Add 3 new widgets: Earning Reports (weekly), Popular Products, Recent Store Orders |

## Technical Notes

- No new dependencies needed
- No database changes needed
- The weekly earnings chart reuses existing `payments` table data but with a different time filter (current week vs. 12 months)
- Popular Products query uses `invoice_items` table which already tracks product sales
- The existing Earning Reports widget (monthly bar chart) will be kept but renamed to "Monthly Revenue" to differentiate from the new weekly one
