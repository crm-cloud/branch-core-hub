

# Backend Connection & Benefits Settings Card-Grid Redesign

## Backend Connection Status

**No errors found.** The console logs show only a harmless React ref warning on the `Badge` component inside `PublicWebsite.tsx` (a function component receiving a ref without `forwardRef`). There are no network errors, no failed API calls, and no authentication issues. The user is currently on the public landing page (`/`), which does not require authentication. The backend connection is healthy.

## Benefits Settings Card-Grid Redesign

### Problem

The current `BenefitSettingsComponent.tsx` (lines 286-318) renders each bookable benefit type as a full-size `Card` with 10+ inline form fields (duration, capacity, operating hours, no-show policy, etc.). When multiple benefit types exist, this creates excessive vertical scrolling and visual clutter.

### Solution

Replace the expanded form cards in the "Slot Booking Settings" section with a **compact responsive card grid**. Each card shows:
- Icon + Name
- On/Off toggle (slot booking enabled)
- Key stats summary (duration, capacity) when enabled
- A "Configure" button that opens a **Sheet/Drawer** with the full settings form

### Changes

**File: `src/components/settings/BenefitSettingsComponent.tsx`**

1. **Move `BenefitSettingForm` into a Sheet**: Convert the inline form into a `Sheet` (side drawer) that opens when "Configure" is clicked on a benefit card.

2. **Create compact card grid**: Replace the `space-y-4` stacked layout (line 296) with a `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` layout. Each card contains:
   - Icon in a colored circle
   - Benefit name and category badge
   - Switch toggle for enable/disable (saves immediately on toggle)
   - Mini stats row: "30 min slots · Cap: 4" (when enabled)
   - "Configure" button (when enabled)

3. **Drawer form**: When "Configure" is clicked, open a `Sheet` with the full settings form (all existing fields: duration, capacity, operating hours, buffer, no-show policy, etc.) plus a Save button. This is the same form content currently in lines 104-237, just wrapped in a Sheet.

4. **State management**: Add `configureTypeId` state to track which benefit type's drawer is open. The drawer receives the benefit type data and saves via the existing `useUpsertBenefitSetting` hook.

### Visual Layout

```text
┌─────────────────────────────────────────────────────┐
│  Slot Booking Settings                              │
├────────────┬────────────┬────────────┐              │
│ 🔥 Sauna   │ ❄️ Ice Bath │ 💧 Steam   │              │
│ [ON]       │ [ON]       │ [OFF]      │              │
│ 30min · 4  │ 15min · 2  │            │              │
│ [Configure]│ [Configure]│            │              │
└────────────┴────────────┴────────────┘              │
                                                      │
│  ← Sheet Drawer opens on "Configure" click          │
│     with full form fields                           │
└─────────────────────────────────────────────────────┘
```

### Technical Approach

- Keep the existing `BenefitSettingForm` function but wrap its form body inside a `Sheet` instead of an inline `Card`.
- Add new state: `const [configureType, setConfigureType] = useState<{id: string, ...} | null>(null)`
- The compact card's Switch toggle immediately calls `upsertSetting.mutateAsync` to toggle `is_slot_booking_enabled` without opening the drawer.
- No database changes required -- all existing hooks and services remain unchanged.

