

# Complete Incline Gym System Enhancement Plan

## Executive Summary

Based on comprehensive audit, this plan addresses 6 key areas: Biometric Avatar Upload workflow, Role Management improvements, Dashboard Identity enhancements, POS & Inventory improvements, Device Management layout fixes, and Communication Template Manager. Most core infrastructure is already in place - this plan fills the remaining gaps.

---

## Current State Analysis

### Already Working (No Changes Needed)

| Feature | Status | Evidence |
|---------|--------|----------|
| Member Avatar Upload | Fully Integrated | `MemberAvatarUpload` component in `AddMemberDrawer`, uploads to `avatars` bucket |
| Biometric Sync Service | Fully Integrated | `biometricService.ts` queues sync to devices, updates `biometric_enrolled` flag |
| Role Management (user_roles table) | Fully Integrated | `AdminRoles.tsx` allows adding/removing roles, uses separate `user_roles` table |
| POS Inventory Deduction | Fully Integrated | `storeService.ts` decrements `inventory` table on sale |
| POS Invoice Generation | Fully Integrated | Creates invoice, payment record, and invoice items |
| Member Code Search in POS | Fully Integrated | Uses `search_members` RPC for code, name, phone, email search |
| Device Management Page | Fully Integrated | `DeviceManagement.tsx` with AddDeviceDrawer, EditDeviceDrawer, LiveAccessLog |
| Templates Database Table | Already Exists | `templates` table with name, type, subject, content, variables |
| Broadcast Drawer | Exists | `BroadcastDrawer.tsx` sends messages but uses hardcoded templates |

---

## Issues Requiring Implementation

### Issue 1: Staff/Trainer Avatar Upload Missing

**Current State:** 
- `AddMemberDrawer.tsx` (line 176-184) has `MemberAvatarUpload` component
- `AddTrainerDrawer.tsx` and `AddEmployeeDrawer.tsx` do NOT have avatar upload

**Problem:** Trainers and staff cannot upload photos for biometric enrollment

**Solution:** Add avatar upload to trainer and employee creation workflows

**Files to Modify:**
- `src/components/trainers/AddTrainerDrawer.tsx` - Add `StaffAvatarUpload` component
- `src/components/trainers/EditTrainerDrawer.tsx` - Add avatar in edit workflow
- `src/components/employees/AddEmployeeDrawer.tsx` - Add `StaffAvatarUpload` component
- `src/components/employees/EditEmployeeDrawer.tsx` - Add avatar in edit workflow

**Technical Details:**
```typescript
// Import existing StaffAvatarUpload
import { StaffAvatarUpload } from '@/components/common/StaffAvatarUpload';

// Add state
const [avatarUrl, setAvatarUrl] = useState('');

// Add to form (before name fields)
<div className="flex justify-center pb-2">
  <StaffAvatarUpload
    avatarUrl={avatarUrl}
    name={newUserFormData.full_name || 'New Staff'}
    onAvatarChange={setAvatarUrl}
    size="lg"
  />
</div>

// Pass to create-staff-user edge function
avatarUrl: avatarUrl || null,
```

---

### Issue 2: Biometric Sync Trigger on Photo Upload

**Current State:** 
- `biometricService.ts` has `queueMemberSync` and `queueStaffSync` functions
- These are NOT called automatically when photos are uploaded

**Problem:** Users must manually trigger sync; should be automatic

**Solution:** Add automatic biometric sync after avatar upload

**Files to Modify:**
- `src/components/members/MemberAvatarUpload.tsx` - Call `queueMemberSync` after upload
- `src/components/common/StaffAvatarUpload.tsx` - Call `queueStaffSync` after upload
- `src/components/members/EditProfileDrawer.tsx` - Trigger sync when photo changes

**Technical Details:**
```typescript
// After successful upload in MemberAvatarUpload.tsx
import { queueMemberSync } from '@/services/biometricService';

// After line 76 (onAvatarChange)
if (userId) {
  try {
    await queueMemberSync(userId, publicUrl, name);
    toast.success('Photo queued for device sync');
  } catch (err) {
    console.warn('Biometric sync queued failed:', err);
  }
}
```

---

### Issue 3: Dashboard Identity Enhancement

**Current State:**
- Dashboard (line 221) shows `Welcome back, {first_name}!`
- Member code and role badge are NOT prominently displayed in header
- Role badges are at the bottom of the page (lines 348-363)

**Problem:** User identity (member code) and role should be visible in header

**Solution:** Enhance AppHeader with member code and role badge

**Files to Modify:**
- `src/components/layout/AppHeader.tsx` - Add member code and role badge display
- `src/pages/MemberDashboard.tsx` - Show member code prominently (if exists)

**Technical Details for AppHeader:**
```typescript
// In AppHeader, enhance the user menu label (lines 83-90)
<DropdownMenuLabel className="font-normal">
  <div className="flex flex-col space-y-1">
    <div className="flex items-center gap-2">
      <p className="text-sm font-medium leading-none">{profile?.full_name || 'User'}</p>
      {/* Role Badge - moved to top */}
      <Badge variant="secondary" className="text-xs capitalize">
        {primaryRole?.role || primaryRole}
      </Badge>
    </div>
    {/* Member Code if exists */}
    {memberCode && (
      <p className="text-xs font-mono text-primary">{memberCode}</p>
    )}
    <p className="text-xs leading-none text-muted-foreground">{profile?.email}</p>
  </div>
</DropdownMenuLabel>
```

**Additional Query in AppHeader:**
```typescript
// Fetch member code if user is a member
const { data: memberData } = useQuery({
  queryKey: ['user-member-code', user?.id],
  queryFn: async () => {
    if (!user?.id) return null;
    const { data } = await supabase
      .from('members')
      .select('member_code')
      .eq('user_id', user.id)
      .single();
    return data?.member_code;
  },
  enabled: !!user?.id && roles.some(r => (r.role || r) === 'member'),
});
```

---

### Issue 4: Real-time Attendance Feed on Dashboard

**Current State:**
- Dashboard shows "Recent Activity" with check-ins from `member_attendance` table
- Uses standard query, NOT real-time subscription

**Problem:** Activity feed doesn't update automatically when turnstile events occur

**Solution:** Add Supabase Realtime subscription for live attendance feed

**Files to Modify:**
- `src/pages/Dashboard.tsx` - Add realtime subscription for `device_access_events`
- `src/components/devices/LiveAccessLog.tsx` - Already has realtime (can embed in Dashboard)

**Technical Details:**
```typescript
// Add to Dashboard.tsx
import { LiveAccessLog } from '@/components/devices/LiveAccessLog';

// Replace static "Recent Activity" card with LiveAccessLog
<Card className="border-border/50 md:col-span-2">
  <CardHeader>
    <CardTitle className="text-lg">Live Access Feed</CardTitle>
  </CardHeader>
  <CardContent>
    <LiveAccessLog maxItems={8} showHeader={false} />
  </CardContent>
</Card>
```

---

### Issue 5: POS Split Payments Support

**Current State:**
- POS supports single payment method (cash, card, wallet, upi)
- No split payment capability

**Problem:** Cannot handle "half cash, half card" scenarios

**Solution:** Add split payment UI and backend support

**Files to Modify:**
- `src/pages/POS.tsx` - Add split payment toggle and amount inputs
- `src/services/storeService.ts` - Modify `createPOSSale` to accept multiple payments

**Technical Details:**
```typescript
// Add state for split payments
const [splitPayment, setSplitPayment] = useState(false);
const [payments, setPayments] = useState<{method: string; amount: number}[]>([
  { method: 'cash', amount: 0 }
]);

// UI for split payment
{splitPayment ? (
  <div className="space-y-2">
    {payments.map((p, idx) => (
      <div key={idx} className="flex gap-2">
        <Select value={p.method} onValueChange={...}>
          ...payment method options
        </Select>
        <Input type="number" value={p.amount} onChange={...} />
        <Button variant="ghost" onClick={() => removePayment(idx)}>
          <Trash2 />
        </Button>
      </div>
    ))}
    <Button variant="outline" onClick={addPayment}>Add Payment Method</Button>
  </div>
) : (
  // existing single payment select
)}
```

---

### Issue 6: Communication Template Manager

**Current State:**
- `templates` table exists with proper schema
- `messageTemplates.ts` has hardcoded templates
- `BroadcastDrawer` doesn't fetch from database

**Problem:** Templates are not managed in Settings, broadcast doesn't use saved templates

**Solution:** Create Template Manager in Settings and link to Broadcast

**Files to Create:**
- `src/components/settings/TemplateManager.tsx` - CRUD for templates

**Files to Modify:**
- `src/pages/Settings.tsx` - Add "Templates" tab
- `src/components/announcements/BroadcastDrawer.tsx` - Add template selector from database

**Technical Details for TemplateManager:**
```typescript
// Template Manager component
export function TemplateManager() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showEditor, setShowEditor] = useState(false);

  // Fetch templates from database
  const { data: templates } = useQuery({
    queryKey: ['communication-templates'],
    queryFn: async () => {
      const { data } = await supabase
        .from('templates')
        .select('*')
        .order('type', { ascending: true });
      return data;
    },
  });

  // Create/Update mutation
  // Delete mutation
  
  // Template editor with variable support
  // Variables: {{member_name}}, {{days_left}}, {{member_code}}, {{plan_name}}, {{end_date}}
}
```

**Enhanced BroadcastDrawer:**
```typescript
// Add template selector
const { data: savedTemplates = [] } = useQuery({
  queryKey: ['broadcast-templates', broadcastData.type],
  queryFn: async () => {
    const { data } = await supabase
      .from('templates')
      .select('*')
      .eq('type', broadcastData.type)
      .eq('is_active', true);
    return data;
  },
});

// Template dropdown
<Select onValueChange={(templateId) => {
  const template = savedTemplates.find(t => t.id === templateId);
  if (template) {
    setBroadcastData({ ...broadcastData, message: template.content });
  }
}}>
  <SelectTrigger>
    <SelectValue placeholder="Select template (optional)" />
  </SelectTrigger>
  <SelectContent>
    {savedTemplates.map(t => (
      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
    ))}
  </SelectContent>
</Select>
```

---

## Implementation Summary

| Task | Priority | Complexity | Files |
|------|----------|------------|-------|
| Staff/Trainer Avatar Upload | High | Low | AddTrainerDrawer, AddEmployeeDrawer, EditTrainerDrawer, EditEmployeeDrawer |
| Auto Biometric Sync on Upload | High | Low | MemberAvatarUpload, StaffAvatarUpload |
| Dashboard Identity Enhancement | Medium | Low | AppHeader, add member code + role badge |
| Live Attendance Feed | Medium | Low | Dashboard (embed LiveAccessLog) |
| POS Split Payments | Medium | Medium | POS.tsx, storeService.ts |
| Template Manager in Settings | Medium | Medium | New TemplateManager.tsx, Settings.tsx |
| Broadcast Template Integration | Medium | Low | BroadcastDrawer.tsx |

---

## Files Summary

### New Files (1 total)

| File | Type | Description |
|------|------|-------------|
| `src/components/settings/TemplateManager.tsx` | Component | CRUD for communication templates |

### Modified Files (10 total)

| File | Changes |
|------|---------|
| `src/components/trainers/AddTrainerDrawer.tsx` | Add StaffAvatarUpload component |
| `src/components/trainers/EditTrainerDrawer.tsx` | Add avatar editing |
| `src/components/employees/AddEmployeeDrawer.tsx` | Add StaffAvatarUpload component |
| `src/components/employees/EditEmployeeDrawer.tsx` | Add avatar editing |
| `src/components/members/MemberAvatarUpload.tsx` | Auto-queue biometric sync |
| `src/components/common/StaffAvatarUpload.tsx` | Auto-queue biometric sync |
| `src/components/layout/AppHeader.tsx` | Add member code and prominent role badge |
| `src/pages/Dashboard.tsx` | Embed LiveAccessLog for real-time feed |
| `src/pages/Settings.tsx` | Add "Templates" tab |
| `src/components/announcements/BroadcastDrawer.tsx` | Add database template selector |

### No Changes Needed (Already Working)

- Role Management (user_roles table properly used in AdminRoles.tsx)
- POS Inventory Sync (storeService.ts decrements inventory on sale)
- POS Member Search (uses search_members RPC)
- Device Management Layout (properly wrapped in AppLayout)
- POS Invoice & Payment Generation (fully integrated)

---

## Technical Notes

### Avatar Storage Buckets
- `avatars` bucket (public) - For general profile photos
- `member-photos` bucket (private) - For biometric-grade member photos

### Biometric Sync Flow
1. User uploads photo via MemberAvatarUpload/StaffAvatarUpload
2. Photo uploaded to storage bucket
3. `queueMemberSync` or `queueStaffSync` called
4. Entry added to `biometric_sync_queue` table with status `pending`
5. Android terminal polls `device-sync-data` edge function
6. Terminal downloads photo, registers face
7. Terminal reports completion, status updated to `completed`
8. `biometric_enrolled` flag set to `true` on member/employee

### Template Variables Supported
- `{{member_name}}` - Full name
- `{{member_code}}` - Unique member ID (e.g., INC-0001)
- `{{days_left}}` - Days until membership expiry
- `{{end_date}}` - Membership end date
- `{{plan_name}}` - Current membership plan
- `{{amount}}` - Payment amount (for invoices)
- `{{invoice_number}}` - Invoice reference

