
# Dashboard Widgets and Notification System Overhaul

## Part 1: Membership Distribution Donut Chart (Vuexy Style Upgrade)

The existing `MembershipDistribution` component in `DashboardCharts.tsx` already renders a donut/pie chart. It will be restyled to match the Vuexy aesthetic:

- Add `shadow-lg rounded-2xl` card styling with clean white background
- Move the legend from bottom to the right side of the chart using `layout="vertical" align="right" verticalAlign="middle"`
- Add colored dots in the legend with percentage labels (e.g., "Gold 40%")
- Increase chart size and add a center label showing total count
- Use more vibrant Vuexy-inspired colors (purple, cyan, green, amber palette)

**File:** `src/components/dashboard/DashboardCharts.tsx` (modify `MembershipDistribution` component, lines 94-170)

## Part 2: Live Access Feed Timeline Restyle

The existing `LiveAccessLog` component will be restyled from a flat list to a Vuexy-style "Activity Timeline" design:

- Replace the `divide-y` list layout with a vertical timeline structure
- Add a continuous vertical gray line on the left (`border-l-2 border-gray-200`)
- Each entry gets a colored circular node on the line (green = granted, red = denied)
- Content layout: member avatar, bold name + action text, gray subtext for location/device
- Right-aligned relative time ("2 mins ago")
- Remove the outer Card wrapper since Dashboard.tsx already wraps it in a Card

**File:** `src/components/devices/LiveAccessLog.tsx` (restyle the render output, lines 67-143)

## Part 3: Notification System - Realtime Subscription

The database table `notifications` already exists with the correct schema (id, user_id, title, message, type, is_read, created_at, etc.) and has RLS policies configured. However, realtime is NOT enabled.

### 3A: Enable Realtime on notifications table

**Database migration:**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

### 3B: Add Realtime Subscription to NotificationBell

Update `NotificationBell.tsx` to subscribe to Supabase Realtime `INSERT` events on the `notifications` table filtered by user_id. When a new notification arrives:
- Increment the unread count badge instantly
- Invalidate the notifications query so the dropdown refreshes
- Show a toast for important notification types (error/warning)

**File:** `src/components/notifications/NotificationBell.tsx` - Add a `useEffect` with `supabase.channel('notifications')` subscription

### 3C: Auto-generate Notifications via Database Triggers

Create database triggers that automatically insert into the `notifications` table when key events occur:

1. **New Member Registration** - Trigger on `members` INSERT: notifies all owner/admin users at that branch
2. **Payment Received** - Trigger on `payments` INSERT: notifies owner/admin users with amount and member info
3. **Membership Expiring** - This requires a scheduled/cron approach (not a trigger). Instead, we add a check in the dashboard query that creates notifications for memberships expiring within 3 days if no notification has been sent yet.

**Database migration:** Create trigger functions for member registration and payment received events. These will insert rows into `notifications` for users with owner/admin roles at the relevant branch.

```sql
-- Trigger function: new member notification
CREATE OR REPLACE FUNCTION notify_new_member() RETURNS trigger ...
  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT ur.user_id, NEW.branch_id, 'New Member Registered', ...
  FROM user_roles ur WHERE ur.role IN ('owner','admin');

-- Trigger function: payment received notification  
CREATE OR REPLACE FUNCTION notify_payment_received() RETURNS trigger ...
  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT ur.user_id, NEW.branch_id, 'Payment Received', ...
  FROM user_roles ur WHERE ur.role IN ('owner','admin');
```

**Note on Low Stock:** This is best handled at the application level when stock is decremented, not via a trigger, since it requires checking threshold logic. This can be added as a follow-up.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/dashboard/DashboardCharts.tsx` | Restyle `MembershipDistribution` - Vuexy donut with right-side legend, shadow-lg card |
| `src/components/devices/LiveAccessLog.tsx` | Restyle to vertical timeline layout with colored dots and avatars |
| `src/components/notifications/NotificationBell.tsx` | Add Supabase Realtime subscription for instant badge updates |
| Database migration | Enable realtime on notifications; create trigger functions for new member + payment events |

## Technical Details

### MembershipDistribution Restyle
```tsx
// Key changes:
// - Card gets: className="shadow-lg rounded-2xl border-0"
// - PieChart layout changes to side-by-side (chart left, legend right)
// - Legend: layout="vertical" align="right" verticalAlign="middle"
// - Add percentage calculation in legend labels
// - innerRadius={60} outerRadius={90} for better donut look
```

### LiveAccessLog Timeline
```tsx
// Key changes:
// - Remove outer Card (parent already provides it)
// - Each event wrapped in a flex with:
//   - Left: relative div with vertical line + colored dot node
//   - Right: avatar + name (bold) + action + time
// - Vertical line: absolute border-l-2 spanning full height
// - Dot: w-3 h-3 rounded-full, green-500 or red-500 based on access_granted
```

### NotificationBell Realtime
```tsx
// Add useEffect:
useEffect(() => {
  if (!user?.id) return;
  const channel = supabase
    .channel('user-notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.id}`,
    }, () => {
      queryClient.invalidateQueries({ queryKey: ['notification-count'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}, [user?.id]);
```

### Database Triggers
```sql
-- New member notification trigger
CREATE OR REPLACE FUNCTION public.notify_new_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  member_name TEXT;
BEGIN
  SELECT p.full_name INTO member_name FROM profiles p WHERE p.id = NEW.user_id;
  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT ur.user_id, NEW.branch_id,
    'New Member Registered',
    'New member registration: ' || COALESCE(member_name, 'Unknown'),
    'info', 'member'
  FROM user_roles ur
  WHERE ur.role IN ('owner', 'admin')
    AND ur.user_id != COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid);
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_notify_new_member
  AFTER INSERT ON members FOR EACH ROW
  EXECUTE FUNCTION notify_new_member();

-- Payment received notification trigger
CREATE OR REPLACE FUNCTION public.notify_payment_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  member_name TEXT;
BEGIN
  SELECT p.full_name INTO member_name
  FROM members m JOIN profiles p ON p.id = m.user_id
  WHERE m.id = NEW.member_id;
  
  INSERT INTO notifications (user_id, branch_id, title, message, type, category)
  SELECT ur.user_id, NEW.branch_id,
    'Payment Received',
    'Payment of Rs.' || NEW.amount || ' received from ' || COALESCE(member_name, 'a member'),
    'success', 'payment'
  FROM user_roles ur
  WHERE ur.role IN ('owner', 'admin');
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_notify_payment_received
  AFTER INSERT ON payments FOR EACH ROW
  EXECUTE FUNCTION notify_payment_received();
```
