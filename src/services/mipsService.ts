import { supabase } from "@/integrations/supabase/client";

// RuoYi-Vue v3 device shape from /through/device/list
export interface MIPSDevice {
  id: number;
  deviceKey: string;
  deviceName: string;
  name: string;
  ip: string;
  personCount: number;
  faceCount: number;
  onlineFlag: number;
  status: number;
  lastActiveTime: string;
  // keep compatibility aliases
  fpCount?: number;
  devicePassType?: string;
  isOnline?: number;
}

export interface MIPSPassRecord {
  id: number;
  personNo: string;
  personName: string;
  passType: string;
  passPersonType: string;
  temperature: string;
  temperatureState: number;
  maskState: number;
  imgUri: string;
  deviceName: string;
  createTime: string;
}

export interface MIPSEmployee {
  id: number;
  name: string;
  personNo: string;
  gender: number;
  phone: string;
  photoUrl: string;
  departmentName: string;
  expireTime: string;
}

interface MIPSProxyResponse {
  success: boolean;
  status: number;
  data: {
    code?: number;
    msg?: string;
    message?: string;
    data?: unknown;
    rows?: unknown[];
    total?: number;
    [key: string]: unknown;
  };
  error?: string;
}

async function callMIPSProxy(
  endpoint: string,
  method = "GET",
  params?: Record<string, string>,
  data?: Record<string, unknown>
): Promise<MIPSProxyResponse> {
  const { data: result, error } = await supabase.functions.invoke("mips-proxy", {
    body: { endpoint, method, params, data },
  });

  if (error) throw new Error(error.message || "MIPS proxy call failed");
  return result as MIPSProxyResponse;
}

// Test connection by fetching device list
export async function testMIPSConnection(): Promise<{ success: boolean; message: string; raw?: unknown }> {
  try {
    const result = await callMIPSProxy("/through/device/list");
    const isOk = result.success && (result.data?.code === 200 || result.data?.code === 0);
    return {
      success: isOk,
      message: isOk ? "Connected to MIPS server successfully" : `Connection issue: ${result.data?.msg || JSON.stringify(result.data)}`,
      raw: result.data,
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Fetch devices from MIPS
export async function fetchMIPSDevices(): Promise<MIPSDevice[]> {
  const result = await callMIPSProxy("/through/device/list");

  if (!result.success && result.data?.code !== 200 && result.data?.code !== 0) {
    throw new Error(result.data?.msg || "Failed to fetch MIPS devices");
  }

  // RuoYi uses `rows` array or `data` for list responses
  const rows = result.data?.rows || result.data?.data;
  if (!Array.isArray(rows)) return [];

  return rows.map((d: any) => ({
    id: d.id || d.deviceId,
    deviceKey: d.deviceKey || d.sn || d.serialNumber || "",
    deviceName: d.deviceName || d.name || "",
    name: d.deviceName || d.name || d.deviceKey || "",
    ip: d.ip || d.ipAddress || "",
    personCount: d.personCount ?? d.personNum ?? 0,
    faceCount: d.photoCount ?? d.faceCount ?? d.faceNum ?? 0,
    onlineFlag: d.onlineFlag ?? (d.status === "0" ? 0 : d.status === "1" ? 1 : Number(d.status) || 0),
    status: d.onlineFlag ?? (d.status === "0" ? 0 : d.status === "1" ? 1 : Number(d.status) || 0),
    lastActiveTime: d.lastActiveTime || d.updateTime || "",
  }));
}

// Fetch pass records from MIPS
export async function fetchMIPSPassRecords(page = 1, size = 20): Promise<{
  records: MIPSPassRecord[];
  total: number;
}> {
  const result = await callMIPSProxy("/through/record/list", "GET", {
    pageNum: String(page),
    pageSize: String(size),
  });

  const rows = result.data?.rows || result.data?.data;
  const total = (result.data?.total as number) || 0;
  return { records: Array.isArray(rows) ? rows as MIPSPassRecord[] : [], total };
}

// Fetch persons from MIPS
export async function fetchMIPSEmployees(page = 1, size = 50): Promise<{
  employees: MIPSEmployee[];
  total: number;
}> {
  const result = await callMIPSProxy("/personInfo/person/list", "GET", {
    pageNum: String(page),
    pageSize: String(size),
  });

  const rows = result.data?.rows || result.data?.data;
  const total = (result.data?.total as number) || 0;
  return { employees: Array.isArray(rows) ? rows as MIPSEmployee[] : [], total };
}

// Sync a person to MIPS
export async function syncPersonToMIPS(
  personType: "member" | "employee",
  personId: string,
  branchId?: string
): Promise<{ success: boolean; mips_person_id?: string; error?: string; mips_response?: unknown; endpoint_used?: string }> {
  const { data, error } = await supabase.functions.invoke("sync-to-mips", {
    body: { person_type: personType, person_id: personId, branch_id: branchId },
  });

  if (error) throw new Error(error.message || "Sync failed");
  return data;
}

// Remote open door — GET /through/device/openDoor/{id}
export async function remoteOpenDoor(deviceId: number): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy(`/through/device/openDoor/${deviceId}`, "GET");
    const isOk = result.success && (result.data?.code === 200 || result.data?.code === 0);
    return {
      success: isOk,
      message: isOk ? "Door opened successfully" : (result.data?.msg || "Failed to open door"),
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Restart device
export async function restartDevice(deviceId: number): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy(`/through/device/restart/${deviceId}`, "GET");
    const isOk = result.success && (result.data?.code === 200 || result.data?.code === 0);
    return {
      success: isOk,
      message: isOk ? "Device restarting..." : (result.data?.msg || "Failed to restart device"),
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Dispatch a synced person to device via syncPerson
export async function dispatchToDevice(
  personMipsId: string,
  targetDeviceId = 13
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy("/through/device/syncPerson", "POST", undefined, {
      personId: personMipsId,
      deviceIds: [targetDeviceId],
    });
    const isOk = result.success && (result.data?.code === 200 || result.data?.code === 0);
    return {
      success: isOk,
      message: isOk ? "Person dispatched to device" : (result.data?.msg || "Failed to dispatch"),
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Fetch online device IDs
export async function fetchOnlineDeviceIds(): Promise<number[]> {
  try {
    const devices = await fetchMIPSDevices();
    return devices
      .filter((d) => d.onlineFlag === 1 || d.status === 1)
      .map((d) => d.id)
      .filter((id) => !isNaN(id));
  } catch {
    return [];
  }
}

// Capture face photo via device camera
export async function capturePhoto(
  personMipsId: number,
  deviceId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy("/through/device/capturePhoto", "POST", undefined, {
      personId: personMipsId,
      deviceId: deviceId,
    });
    const isOk = result.success && (result.data?.code === 200 || result.data?.code === 0);
    return {
      success: isOk,
      message: isOk ? "Photo capture triggered on device" : (result.data?.msg || "Failed to capture photo"),
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Assign device permission for a synced person
export async function assignDevicePermission(
  personMipsId: string,
  deviceIds: number[]
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy("/through/device/syncPerson", "POST", undefined, {
      personId: personMipsId,
      deviceIds,
    });
    const isOk = result.success && (result.data?.code === 200 || result.data?.code === 0);
    return {
      success: isOk,
      message: isOk ? "Permission assigned successfully" : (result.data?.msg || "Failed to assign permission"),
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Fetch all persons from MIPS (for bulk verification)
export async function fetchAllMIPSPersons(pageSize = 200): Promise<MIPSEmployee[]> {
  const all: MIPSEmployee[] = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const { employees, total } = await fetchMIPSEmployees(page, pageSize);
    all.push(...employees);
    hasMore = all.length < total;
    page++;
    if (page > 10) break; // safety cap
  }
  return all;
}

// Verify a single person exists on MIPS by personNo (hyphen-stripped)
export async function verifyPersonOnMIPS(personNo: string): Promise<{
  exists: boolean;
  hasPhoto: boolean;
  mipsId: number | null;
  personData: MIPSEmployee | null;
}> {
  const stripped = personNo.replace(/-/g, "");
  const result = await callMIPSProxy("/personInfo/person/list", "GET", {
    personNo: stripped,
    pageNum: "1",
    pageSize: "10",
  });

  const rows = result.data?.rows || result.data?.data;
  if (!Array.isArray(rows) || rows.length === 0) {
    return { exists: false, hasPhoto: false, mipsId: null, personData: null };
  }

  const person = rows.find((r: any) => r.personNo === stripped) || rows[0];
  return {
    exists: true,
    hasPhoto: !!(person as any).photoUrl || !!(person as any).personPhotoUrl,
    mipsId: (person as any).id || null,
    personData: person as MIPSEmployee,
  };
}

// Compare CRM synced count vs MIPS person count
export async function compareCRMvsMIPS(crmSyncedCount: number): Promise<{
  crmSynced: number;
  mipsTotal: number;
  match: boolean;
}> {
  const result = await callMIPSProxy("/personInfo/person/list", "GET", {
    pageNum: "1",
    pageSize: "1",
  });
  const mipsTotal = (result.data?.total as number) || 0;
  return {
    crmSynced: crmSyncedCount,
    mipsTotal,
    match: crmSyncedCount === mipsTotal,
  };
}

// Manual sync test — syncs one person and verifies in MIPS roster
export async function manualSyncTest(
  personType: "member" | "employee",
  personId: string,
  personNo: string,
  branchId?: string
): Promise<{ syncResult: any; verifyResult: any; verified: boolean }> {
  const syncResult = await syncPersonToMIPS(personType, personId, branchId);

  const strippedNo = personNo.replace(/-/g, "");
  let verified = false;
  let verifyResult: any = null;
  try {
    const { employees } = await fetchMIPSEmployees(1, 100);
    const found = employees.find(
      (e) => e.personNo === strippedNo || e.personNo === personNo || String(e.id) === String(syncResult.mips_person_id)
    );
    verified = !!found;
    verifyResult = found || { message: `Person ${strippedNo} not found in MIPS roster after sync` };
  } catch (e) {
    verifyResult = { error: e instanceof Error ? e.message : String(e) };
  }

  return { syncResult, verifyResult, verified };
}
