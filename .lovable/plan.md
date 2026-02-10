
# Dashboard Vuexy Overhaul & Logic Fixes

## Overview
Complete visual overhaul of the Dashboard page to match Vuexy admin template aesthetics, with structural changes to widgets and a critical fix for the pending invoices/accounts receivable logic.

---

## Part 1: Global Card Styling

**File: `src/components/ui/stat-card.tsx`**
- Update the Card className to use `rounded-xl border-none shadow-lg shadow-indigo-100`
- Bolder headings with `font-bold text-slate-800` for value text

**File: `src/components/ui/card.tsx`**
- No global changes here (would break other pages). Instead, apply Vuexy styles per-component on Dashboard.

---

## Part 2: Hero Card (Replace Top Stat Row)

**File: `src/pages/Dashboard.tsx`**

**Delete:** The two stat card grids (lines 300-364) -- "Total Members", "Today's Check-ins", "Monthly Revenue", "New Leads", "Expiring Soon", "Pending Invoices", "Active Trainers", "Today's Classes", "Currently In Gym".

**Replace with:**

### A. Hero Gradient Card
A full-width card with `bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl shadow-lg text-white`:
- Left: "Gym Health" title in large white text with a subtitle
- Right: 3-column grid showing:
  - Total Members (white, large number)
  - Revenue this Month (white, formatted currency)
  - Expiring Soon (with pink/red badge if > 0)

### B. Secondary Stats Row (Compact)
A smaller row of 4 cards below the hero for: New Leads, Active Trainers, Today's Classes, Pending Approvals. These keep the `StatCard` component but with updated `rounded-xl border-none shadow-lg shadow-indigo-100` styling.

---

## Part 3: Live Occupancy Gauge (Replace Redundant Widgets)

**Delete:** "Currently In Gym" and "Today's Check-ins" stat cards (already removed in Part 2).

**Add:** A new `OccupancyGauge` component in `src/components/dashboard/OccupancyGauge.tsx`:
- Semi-circle gauge (using Recharts `PieChart` with `startAngle={180}` / `endAngle={0}`)
- Shows `currentlyIn / 50 Capacity`
- Color: Green (`#10b981`) if occupancy < 50%, Orange (`#f59e0b`) if > 80%, otherwise blue
- Placed in the CRM widgets row alongside other charts

---

## Part 4: Accounts Receivable Widget (Fix Pending Invoices Logic)

**Replace:** The `RevenueSnapshotWidget` in `DashboardCharts.tsx` with a new `AccountsReceivableWidget`.

**File: `src/components/dashboard/DashboardCharts.tsx`**

**Query Logic (in `Dashboard.tsx`):**
```sql
SELECT i.id, i.total_amount, i.amount_paid, i.status,
       m.member_code, p.full_name
FROM invoices i
JOIN members m ON m.id = i.member_id
JOIN profiles p ON p.id = m.user_id
WHERE i.status IN ('pending', 'overdue')
  AND (i.total_amount - COALESCE(i.amount_paid, 0)) > 0
ORDER BY (i.total_amount - i.amount_paid) DESC
LIMIT 5
```

**Widget UI:**
- Title: "Accounts Receivable"
- Total outstanding amount at top (SUM of total_amount - amount_paid)
- List of members who owe money with name, amount owed, and a "View" button linking to `/invoices`
- Styled with `shadow-lg rounded-2xl border-0`

---

## Part 5: Notification System Verification

The notification bell already has:
- Realtime subscription (added in previous iteration)
- Database triggers for new member and payment events
- Red badge with unread count
- Scrollable dropdown

**No changes needed** -- the notification system was fixed in the previous iteration. It should be working. If there are issues, they would be related to the triggers or realtime publication (already enabled).

---

## Part 6: Dashboard Layout Restructure

**File: `src/pages/Dashboard.tsx`** -- New layout order:

```
1. Header (Welcome + Branch Selector)
2. Hero Gradient Card (Total Members, Revenue, Expiring)
3. Secondary Stats Row (4 cards: Leads, Trainers, Classes, Approvals)
4. Charts Row (Revenue Chart + Attendance Chart) -- unchanged
5. CRM Widgets Row:
   - Occupancy Gauge (NEW)
   - Hourly Attendance Chart
   - Accounts Receivable (NEW, replaces Revenue Snapshot)
   - Expiring Members Widget
6. Bottom Row:
   - Membership Distribution (donut) -- unchanged
   - Live Access Feed (timeline) -- unchanged
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/pages/Dashboard.tsx` | Major restructure: hero card, remove redundant stats, new layout |
| `src/components/dashboard/DashboardCharts.tsx` | Add `AccountsReceivableWidget`, remove `RevenueSnapshotWidget` |
| `src/components/dashboard/OccupancyGauge.tsx` | **NEW** - Semi-circle gauge component |
| `src/components/ui/stat-card.tsx` | Update default card styling to Vuexy (rounded-xl, shadow-lg) |

---

## Technical Details

### Hero Card Component (inline in Dashboard.tsx)
```tsx
<div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
    <div>
      <h2 className="text-2xl font-bold tracking-tight">Gym Health</h2>
      <p className="text-white/70 text-sm mt-1">Real-time overview of your business</p>
    </div>
    <div className="grid grid-cols-3 gap-6">
      <div className="text-center">
        <p className="text-3xl font-bold">{stats?.totalMembers || 0}</p>
        <p className="text-white/70 text-xs mt-1">Total Members</p>
      </div>
      <div className="text-center">
        <p className="text-3xl font-bold">Rs.{(stats?.monthlyRevenue || 0).toLocaleString()}</p>
        <p className="text-white/70 text-xs mt-1">Revenue This Month</p>
      </div>
      <div className="text-center">
        <p className="text-3xl font-bold">{stats?.expiringMemberships || 0}</p>
        {(stats?.expiringMemberships || 0) > 0 && (
          <Badge className="bg-pink-500 text-white text-xs mt-1">Action Needed</Badge>
        )}
        <p className="text-white/70 text-xs mt-1">Expiring Soon</p>
      </div>
    </div>
  </div>
</div>
```

### Occupancy Gauge
```tsx
// Semi-circle using Recharts PieChart
// startAngle={180}, endAngle={0}
// Two cells: filled (current) + empty (remaining capacity)
// Center text: "X / 50"
// Color based on percentage threshold
```

### Accounts Receivable Query (new in Dashboard.tsx)
```tsx
const { data: receivables = [] } = useQuery({
  queryKey: ['accounts-receivable', branchFilter],
  enabled: !!user,
  queryFn: async () => {
    let query = supabase
      .from('invoices')
      .select('id, total_amount, amount_paid, status, member_id, members(member_code, user_id, profiles:user_id(full_name))')
      .in('status', ['pending', 'overdue'])
      .order('total_amount', { ascending: false })
      .limit(5);
    if (branchFilter) query = query.eq('branch_id', branchFilter);
    const { data } = await query;
    return (data || [])
      .map((inv: any) => ({
        id: inv.id,
        memberName: inv.members?.profiles?.full_name || 'Unknown',
        memberCode: inv.members?.member_code || '',
        owed: (inv.total_amount || 0) - (inv.amount_paid || 0),
        status: inv.status,
      }))
      .filter((r: any) => r.owed > 0);
  },
});
```

### StatCard Vuexy Update
```tsx
// Line 46 change:
// FROM: 'border-border/50 transition-all hover:shadow-md'
// TO:   'rounded-xl border-none shadow-lg shadow-indigo-100 transition-all hover:shadow-xl'
```
