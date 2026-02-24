

# Fix Plan: Gender Filter, Attendance UX, Equipment Bug, Device Audit

## Issue 1: Gender Logic in Benefit Allocation (CRITICAL)

**Root Cause Confirmed:** The `BenefitsUsageTab` in `MemberProfileDrawer.tsx` (line 38-50) queries `plan_benefits` directly -- it shows ALL benefits in the plan regardless of member gender. The plan includes both "SAUNA ROOM F" (linked to a female-only facility) and "Sauna Room M" (linked to a male-only facility). A male member like Kuldeep sees both.

The gender filter only exists in the booking flow (`MemberClassBooking.tsx` and `BookBenefitSlot.tsx`), NOT in the benefits display.

**Fix:** In the `BenefitsUsageTab` component:
1. Fetch the member's gender from the parent `memberDetails.profiles.gender`
2. For each `plan_benefit`, look up its linked facility via `benefit_type_id` to check `gender_access`
3. Filter out benefits whose facility has `gender_access` opposite to the member's gender
4. If member gender is not set, show all (same pattern as booking page)

**Technical approach:**
- After fetching `planBenefits`, also query `facilities` table filtered by the `benefit_type_id` values
- Build a map: `benefit_type_id -> gender_access`
- Filter `availableBenefits` array: if facility `gender_access` is `male` and member is `female`, hide it (and vice versa). Keep `unisex` and benefits with no facility link.

**File:** `src/components/members/MemberProfileDrawer.tsx` (BenefitsUsageTab function, lines 32-306)

Also apply the same filter to `BookBenefitSlot.tsx` (already partially done but needs the same null-gender fallback).

---

## Issue 2: Attendance Page UX Redesign

**Current State:** The Attendance page (`src/pages/Attendance.tsx`) is already reasonably clean with a search bar, stat cards, and tabs. Looking at the screenshot, it has:
- 3 stat cards (Currently In, Today's Check-ins, Checked Out)
- Quick Check-in card with large search input
- Tabs for Currently In / Today's Log

**Redesign for Rapid Entry:**
- Make the search input auto-focus on page load (already done)
- Add auto-search on 3+ characters (currently requires Enter or button click)
- After check-in, flash a green banner with member name + photo for 3 seconds (visual confirmation)
- After denied check-in, flash a red banner with the denial reason
- Reduce stat cards to a single compact row
- Remove the nested card wrapper around the search input -- make it a direct full-width bar
- Add barcode/scanner icon hint

**File:** `src/pages/Attendance.tsx`

---

## Issue 3: Equipment "Add Equipment" Button Not Working

**Root Cause Confirmed:** There are TWO equipment pages:
1. `/equipment` -> `Equipment.tsx` -- has a working "Add Equipment" button with `AddEquipmentDrawer`
2. `/equipment-maintenance` -> `EquipmentMaintenance.tsx` -- the menu links HERE, and its "Add Equipment" button (line 91) is a plain `<Button>` with NO onClick handler and NO drawer

The menu item in `menu.ts` (line 191) points to `/equipment-maintenance`, so users always land on the broken page.

**Fix:** In `EquipmentMaintenance.tsx` line 90-93, wire the "Add Equipment" button to open an `AddEquipmentDrawer`:
1. Import `AddEquipmentDrawer` 
2. Add state for `addDrawerOpen`
3. Add branch selection (like the Equipment page does)
4. Pass `branchId` to the drawer
5. On success, invalidate equipment queries

**File:** `src/pages/EquipmentMaintenance.tsx`

---

## Issue 4: Device Management API Audit

**Current State:** The `AddDeviceDrawer.tsx` already contains the correct fields for Android Face ID turnstile integration:
- Device Name, IP Address, MAC Address
- Branch selection
- Device Type (Turnstile, Face Terminal, Card Reader)
- Model, Serial Number
- Relay Mode (Manual / Auto-Close)
- Relay Delay slider (1-63 seconds)

The Edge Functions (`device-heartbeat`, `device-sync-data`, `device-access-event`) handle:
- Heartbeat polling (updates `is_online`, `last_heartbeat`)
- Biometric sync queue (pending face data pushed to terminals)
- Access events (membership validation on scan)

**Assessment:** The device management page and API are functionally correct for the documented Android Face ID turnstile workflow. The form fields map to the `access_devices` table columns. The biometric sync queue properly tracks per-device sync status.

**Minor improvements:**
- Add a "Port" field to the Add Device drawer (some turnstile APIs require a port number alongside IP)
- Add a "Test Connection" button that pings the device heartbeat endpoint
- Show the device's `firmware_version` in the device list table (already stored but not displayed)

**Files:** `src/components/devices/AddDeviceDrawer.tsx`, `src/pages/DeviceManagement.tsx`

---

## Execution Summary

| Priority | File | Change |
|----------|------|--------|
| 1 (Critical) | `src/components/members/MemberProfileDrawer.tsx` | Filter benefits by member gender using facility `gender_access` |
| 2 | `src/pages/Attendance.tsx` | UX redesign: auto-search, flash banners, streamlined layout |
| 3 | `src/pages/EquipmentMaintenance.tsx` | Wire "Add Equipment" button to AddEquipmentDrawer with branch selector |
| 4 | `src/components/devices/AddDeviceDrawer.tsx` | Add Port field for turnstile API compatibility |
| 4 | `src/pages/DeviceManagement.tsx` | Show firmware version column in device table |

---

## Technical Details

### Gender Filter for Benefits Tab
```typescript
// Query facilities linked to benefit types
const { data: facilityGenderMap = [] } = useQuery({
  queryKey: ['facility-gender-map', planBenefits],
  queryFn: async () => {
    const btIds = planBenefits.map(b => b.benefit_type_id).filter(Boolean);
    if (!btIds.length) return [];
    const { data } = await supabase
      .from('facilities')
      .select('benefit_type_id, gender_access')
      .in('benefit_type_id', btIds);
    return data || [];
  },
  enabled: planBenefits.length > 0,
});

// Filter benefits
const memberGender = memberDetails?.profiles?.gender; // 'male' | 'female' | null
const filteredBenefits = availableBenefits.filter(b => {
  if (!memberGender) return true; // Show all if gender not set
  const facilityGender = facilityGenderMap.find(f => f.benefit_type_id === b.benefit_type_id);
  if (!facilityGender) return true; // No facility link = show
  return facilityGender.gender_access === 'unisex' || facilityGender.gender_access === memberGender;
});
```

### Equipment Fix
```typescript
// Add to EquipmentMaintenance.tsx
const [addDrawerOpen, setAddDrawerOpen] = useState(false);
const [selectedBranch, setSelectedBranch] = useState<string>('');
const { data: branches = [] } = useBranches();

// Wire the button
<Button onClick={() => setAddDrawerOpen(true)}>
  <Plus className="mr-2 h-4 w-4" /> Add Equipment
</Button>

// Add drawer at bottom
<AddEquipmentDrawer open={addDrawerOpen} onOpenChange={setAddDrawerOpen} branchId={selectedBranch || branches[0]?.id || ''} />
```

### Attendance Auto-Search
```typescript
// Trigger search automatically after 3+ chars with debounce
useEffect(() => {
  if (searchQuery.length >= 3) {
    const timer = setTimeout(() => handleSearch(), 300);
    return () => clearTimeout(timer);
  } else {
    setSearchResults([]);
  }
}, [searchQuery]);
```
