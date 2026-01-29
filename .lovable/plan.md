

# Hardware Management & Biometric Sync Module Implementation Plan

## Executive Summary

This plan implements a complete Turnstile & Face ID Integration system for Incline Gym, enabling hardware management of Android-based access control terminals with facial recognition capabilities. The system bridges the web management software with SMDT-compatible Android terminals.

---

## SDK Analysis (From Uploaded Documents)

The uploaded SDK documentation reveals the following key APIs for the Android terminals:

### Relay Control (Turnstile Gate)
- `setRelayIoMode(int mode, int delay)` - Configure auto-close mode (0=manual, 1=auto-close after X seconds)
- `setRelayIoValue(int value)` - Open (1) or Close (0) the relay/turnstile gate
- `getRelayIoMode()` - Get current relay state

### LED Indicators  
- `setLedLighted(String ledColor, boolean lighted)` - Control LED colors (WHITE, RED, GREEN)

### Wiegand Protocol
- `smdtSendCard(String idCard, int transformat)` - Send card data via Wiegand 26/34
- `smdtReadWiegandData()` - Read incoming card data (blocking method)

### Camera
- `smdtGetCameraVidPid(int cameraId)` - Get camera identification for face recognition

---

## Database Schema

### New Tables Required

```sql
-- 1. Device Registry Table
CREATE TABLE IF NOT EXISTS access_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  device_name TEXT NOT NULL,
  ip_address INET NOT NULL,
  mac_address TEXT,
  device_type TEXT NOT NULL DEFAULT 'turnstile', -- 'turnstile', 'face_terminal', 'card_reader'
  model TEXT,
  firmware_version TEXT,
  serial_number TEXT,
  relay_mode INTEGER DEFAULT 1, -- 0=manual, 1=auto-close
  relay_delay INTEGER DEFAULT 5, -- seconds for auto-close
  is_online BOOLEAN DEFAULT false,
  last_heartbeat TIMESTAMPTZ,
  last_sync TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(ip_address)
);

-- 2. Device Access Events (Live Log)
CREATE TABLE IF NOT EXISTS device_access_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES access_devices(id) ON DELETE SET NULL,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  member_id UUID REFERENCES members(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'face_recognized', 'card_swipe', 'manual_trigger', 'denied'
  access_granted BOOLEAN NOT NULL DEFAULT false,
  denial_reason TEXT, -- 'expired', 'frozen', 'not_found', 'no_photo'
  confidence_score DECIMAL(5,2), -- Face recognition confidence (0-100)
  photo_url TEXT, -- Snapshot from terminal camera
  response_sent TEXT, -- 'OPEN', 'DENIED', 'ERROR'
  device_message TEXT, -- Message displayed on terminal
  processed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Biometric Sync Queue
CREATE TABLE IF NOT EXISTS biometric_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES employees(id) ON DELETE CASCADE,
  device_id UUID REFERENCES access_devices(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL, -- 'add', 'update', 'delete'
  photo_url TEXT NOT NULL,
  person_uuid TEXT NOT NULL, -- UUID sent to device for matching
  person_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- 'pending', 'syncing', 'completed', 'failed'
  retry_count INTEGER DEFAULT 0,
  error_message TEXT,
  queued_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE(member_id, device_id),
  UNIQUE(staff_id, device_id)
);

-- 4. Add biometric_enrolled flag to members
ALTER TABLE members ADD COLUMN IF NOT EXISTS biometric_enrolled BOOLEAN DEFAULT false;
ALTER TABLE members ADD COLUMN IF NOT EXISTS biometric_photo_url TEXT;

-- 5. Add biometric_enrolled flag to employees  
ALTER TABLE employees ADD COLUMN IF NOT EXISTS biometric_enrolled BOOLEAN DEFAULT false;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS biometric_photo_url TEXT;
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE access_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_access_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE biometric_sync_queue ENABLE ROW LEVEL SECURITY;

-- Policies for access_devices (Admin/Manager only)
CREATE POLICY "Managers can view branch devices" ON access_devices
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[])
    OR public.manages_branch(auth.uid(), branch_id)
  );

CREATE POLICY "Admins can manage devices" ON access_devices
  FOR ALL USING (public.has_any_role(auth.uid(), ARRAY['owner', 'admin']::app_role[]));

-- Device access events (Staff+ can view)
CREATE POLICY "Staff can view access events" ON device_access_events
  FOR SELECT USING (
    public.has_any_role(auth.uid(), ARRAY['owner', 'admin', 'manager', 'staff']::app_role[])
  );
```

---

## New Files to Create

### 1. Device Management Service
**File:** `src/services/deviceService.ts`

```typescript
// Core functions:
// - fetchDevices(branchId?) - Get all registered devices
// - addDevice(device) - Register new device
// - updateDevice(id, updates) - Update device settings
// - deleteDevice(id) - Remove device
// - triggerRelay(deviceId) - Remote open turnstile
// - checkDeviceStatus(deviceId) - Ping device heartbeat
// - getAccessEvents(branchId, filters) - Fetch live access log
```

### 2. Biometric Sync Service  
**File:** `src/services/biometricService.ts`

```typescript
// Core functions:
// - queueMemberSync(memberId, deviceIds) - Add member to sync queue
// - queueStaffSync(staffId, deviceIds) - Add staff to sync queue
// - processSyncQueue() - Background job processor
// - getSyncStatus(memberId|staffId) - Check enrollment status
// - removeBiometricData(personId, deviceIds) - Delete from devices
```

### 3. Device Registry Page
**File:** `src/pages/DeviceManagement.tsx`

Features:
- Device list with status indicators (Online/Offline)
- Add Device button → Side Drawer
- Edit device settings → Side Drawer
- Remote Trigger button per device
- Bulk sync members to devices
- Real-time heartbeat status

### 4. Add/Edit Device Drawer
**File:** `src/components/devices/AddDeviceDrawer.tsx`

Fields:
- Device Name (required)
- IP Address (required, validated)
- Branch Location (dropdown from branches)
- Device Type (Turnstile, Face Terminal, Card Reader)
- Model / Serial Number
- Relay Mode (Manual / Auto-close)
- Auto-close Delay (1-63 seconds)

### 5. Live Access Log Widget
**File:** `src/components/devices/LiveAccessLog.tsx`

Features:
- Real-time feed using Supabase Realtime subscriptions
- Shows: Photo thumbnail, Name, Time, Access Result (Granted/Denied)
- Color-coded badges for access results
- Click to view full event details
- Embedded in Admin Dashboard

### 6. Edge Function: Access Event Handler
**File:** `supabase/functions/device-access-event/index.ts`

```typescript
// POST /api/device/access-event
// Receives: { device_id, person_uuid, confidence, photo_base64 }
// 
// Logic:
// 1. Validate device exists and is online
// 2. Look up person_uuid in members/employees
// 3. If member: Check membership status (active, expired, frozen)
// 4. Return: { action: "OPEN"|"DENIED", message: "...", led_color: "GREEN"|"RED" }
// 5. Log event to device_access_events table
// 6. If OPEN: Call member_check_in RPC to log attendance
```

### 7. Edge Function: Device Heartbeat
**File:** `supabase/functions/device-heartbeat/index.ts`

```typescript
// POST /api/device/heartbeat
// Updates device last_heartbeat and is_online status
// Called every 30s from Android terminal
```

### 8. Edge Function: Biometric Sync Endpoint
**File:** `supabase/functions/device-sync-data/index.ts`

```typescript
// GET /api/device/sync-data?device_id=xxx
// Returns pending sync items for a specific device
// Includes: { person_uuid, name, photo_url, action: "add"|"delete" }
```

---

## UI Integration Points

### Dashboard Widget
Add "Live Access" card to Admin Dashboard (`src/pages/Dashboard.tsx`):
- Shows last 5 access events with photos
- Quick link to full Device Management page
- Live counter of "Currently In Gym"

### Member Profile Integration
Update `src/components/members/MemberProfileDrawer.tsx`:
- Add "Biometric Status" badge (Enrolled / Not Enrolled)
- Add "Sync to Devices" button to manually trigger enrollment
- Show last access event for this member

### Settings Integration
Add "Access Control" section to Settings:
- Default relay mode for new devices
- Default auto-close delay
- Enable/disable biometric requirement

---

## Workflow Diagrams

### Access Control Flow

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Android        │     │  Supabase        │     │  Incline Web    │
│  Terminal       │     │  Edge Function   │     │  Dashboard      │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         │  1. Face Detected     │                        │
         │  POST /access-event   │                        │
         │ ───────────────────>  │                        │
         │                       │  2. Lookup member_uuid │
         │                       │  3. Check membership   │
         │                       │                        │
         │  4. Response:         │                        │
         │  {action: "OPEN",     │                        │
         │   led: "GREEN"}       │                        │
         │ <───────────────────  │                        │
         │                       │                        │
         │  5. Open Relay        │                        │
         │  setRelayIoValue(1)   │                        │
         │                       │  6. Insert event log   │
         │                       │ ──────────────────────>│
         │                       │                        │
         │                       │  7. Realtime update    │
         │                       │ ──────────────────────>│
         │                       │                        │
         │                       │        8. Live log     │
         │                       │        shows entry     │
         └───────────────────────┴────────────────────────┘
```

### Biometric Enrollment Flow

```text
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Web App        │     │  Supabase        │     │  Android        │
│  (Staff)        │     │  Database        │     │  Terminal       │
└────────┬────────┘     └────────┬─────────┘     └────────┬────────┘
         │                       │                        │
         │  1. Upload avatar     │                        │
         │  to member-photos     │                        │
         │ ───────────────────>  │                        │
         │                       │                        │
         │  2. Click "Sync to    │                        │
         │     Devices"          │                        │
         │ ───────────────────>  │                        │
         │                       │                        │
         │  3. Insert to         │                        │
         │  biometric_sync_queue │                        │
         │ ───────────────────>  │                        │
         │                       │                        │
         │                       │  4. Terminal polls     │
         │                       │  GET /sync-data        │
         │                       │ <───────────────────── │
         │                       │                        │
         │                       │  5. Return pending     │
         │                       │  sync items            │
         │                       │ ──────────────────────>│
         │                       │                        │
         │                       │  6. Download photo     │
         │                       │  Register face         │
         │                       │ <───────────────────── │
         │                       │                        │
         │                       │  7. Mark as completed  │
         │                       │ <───────────────────── │
         └───────────────────────┴────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Database & Core Services (Day 1)
1. Create database migration with all new tables
2. Implement `deviceService.ts` with CRUD operations
3. Implement `biometricService.ts` with sync queue logic
4. Create device-heartbeat edge function

### Phase 2: Device Access Edge Function (Day 2)
1. Implement `device-access-event` edge function
2. Full membership validation logic
3. Automatic attendance logging
4. LED color and message response generation

### Phase 3: Device Management UI (Day 3)
1. Create DeviceManagement.tsx page
2. Add AddDeviceDrawer.tsx component
3. Add EditDeviceDrawer.tsx component
4. Integrate remote trigger functionality

### Phase 4: Live Access Log & Dashboard (Day 4)
1. Create LiveAccessLog.tsx component
2. Add Supabase Realtime subscription
3. Embed widget in Admin Dashboard
4. Add access stats to dashboard cards

### Phase 5: Member/Staff Biometric Sync (Day 5)
1. Update MemberProfileDrawer with biometric status
2. Add "Sync to Devices" button
3. Implement sync queue processing
4. Update AddMemberDrawer to auto-queue sync

### Phase 6: Testing & Integration (Day 6)
1. Test access event flow end-to-end
2. Test denial scenarios (expired, frozen)
3. Verify attendance logging accuracy
4. Performance test with multiple devices

---

## Technical Specifications

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/device-access-event` | POST | Receive face recognition events |
| `/device-heartbeat` | POST | Device status heartbeat |
| `/device-sync-data` | GET | Get pending biometric sync items |
| `/device-trigger-relay` | POST | Remote open turnstile gate |

### Access Event Request Format

```json
{
  "device_id": "uuid",
  "person_uuid": "member-uuid-or-staff-uuid",
  "confidence": 95.5,
  "photo_base64": "optional-snapshot",
  "timestamp": "2026-01-29T08:00:00Z"
}
```

### Access Event Response Format

```json
{
  "action": "OPEN",           // or "DENIED"
  "message": "Welcome, John!", // Display on terminal
  "led_color": "GREEN",        // LED to illuminate
  "relay_delay": 5,            // Auto-close seconds
  "person_name": "John Doe",
  "member_code": "BR1-00023",
  "plan_name": "Premium Annual",
  "days_remaining": 280
}
```

### Denial Reasons

| Code | Message | LED |
|------|---------|-----|
| `expired` | "Membership Expired - See Reception" | RED |
| `frozen` | "Membership Frozen" | RED |
| `not_found` | "Not Registered" | RED |
| `no_active_plan` | "No Active Plan" | RED |
| `wrong_branch` | "Wrong Branch" | RED |

---

## Files Summary

### New Files (12 total)

| File | Type | Description |
|------|------|-------------|
| `src/services/deviceService.ts` | Service | Device CRUD and control |
| `src/services/biometricService.ts` | Service | Biometric sync queue |
| `src/pages/DeviceManagement.tsx` | Page | Device registry UI |
| `src/components/devices/AddDeviceDrawer.tsx` | Component | Add device form |
| `src/components/devices/EditDeviceDrawer.tsx` | Component | Edit device form |
| `src/components/devices/LiveAccessLog.tsx` | Component | Real-time access feed |
| `src/components/devices/DeviceStatusBadge.tsx` | Component | Online/Offline indicator |
| `supabase/functions/device-access-event/index.ts` | Edge Function | Access validation |
| `supabase/functions/device-heartbeat/index.ts` | Edge Function | Device status |
| `supabase/functions/device-sync-data/index.ts` | Edge Function | Biometric sync |
| `supabase/functions/device-trigger-relay/index.ts` | Edge Function | Remote trigger |
| `supabase/migrations/xxx_access_devices.sql` | Migration | Database schema |

### Modified Files (5 total)

| File | Changes |
|------|---------|
| `src/pages/Dashboard.tsx` | Add Live Access widget |
| `src/components/members/MemberProfileDrawer.tsx` | Add biometric status |
| `src/components/members/AddMemberDrawer.tsx` | Auto-queue biometric sync |
| `src/config/menu.ts` | Add Device Management route |
| `src/App.tsx` | Add DeviceManagement route |

