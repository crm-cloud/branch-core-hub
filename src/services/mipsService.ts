import { supabase } from "@/integrations/supabase/client";

export interface MIPSDevice {
  id: number;
  deviceKey: string;
  name: string;
  ip: string;
  personCount: number;
  faceCount: number;
  fpCount?: number;
  status: number;
  isOnline: number;
  lastActiveTime: string;
  devicePassType: string;
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
    code: number;
    message?: string;
    msg?: string;
    data?: {
      content?: unknown[];
      totalElements?: number;
      totalPages?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  error?: string;
}

async function callMIPSProxy(
  endpoint: string,
  method = "GET",
  params?: Record<string, string>,
  data?: Record<string, unknown>,
  contentType?: "json" | "form"
): Promise<MIPSProxyResponse> {
  const { data: result, error } = await supabase.functions.invoke("mips-proxy", {
    body: { endpoint, method, params, data, contentType },
  });

  if (error) throw new Error(error.message || "MIPS proxy call failed");
  return result as MIPSProxyResponse;
}

// Test connection by generating a token
export async function testMIPSConnection(): Promise<{ success: boolean; message: string; raw?: unknown }> {
  try {
    const result = await callMIPSProxy("/admin/devices/page", "GET", { page: "1", size: "1" });
    const isOk = result.success && result.data?.code === 200;
    return {
      success: isOk,
      message: isOk ? "Connected to MIPS server successfully" : `Connection issue: ${result.data?.message || JSON.stringify(result.data)}`,
      raw: result.data,
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Fetch devices from MIPS
export async function fetchMIPSDevices(): Promise<MIPSDevice[]> {
  const result = await callMIPSProxy("/admin/devices/page", "GET", {
    page: "1",
    size: "100",
  });

  if (!result.success || result.data?.code !== 200) {
    throw new Error(result.data?.message || "Failed to fetch MIPS devices");
  }

  const content = result.data?.data?.content || [];
  return Array.isArray(content) ? content as MIPSDevice[] : [];
}

// Fetch pass records from MIPS
export async function fetchMIPSPassRecords(page = 1, size = 20): Promise<{
  records: MIPSPassRecord[];
  total: number;
}> {
  const result = await callMIPSProxy("/admin/pass/pass_records/page", "GET", {
    page: String(page),
    size: String(size),
  });

  if (!result.success || result.data?.code !== 200) {
    throw new Error(result.data?.message || "Failed to fetch MIPS pass records");
  }

  const content = result.data?.data?.content || [];
  const total = result.data?.data?.totalElements || 0;
  return { records: Array.isArray(content) ? content as MIPSPassRecord[] : [], total: total as number };
}

// Fetch employees from MIPS
export async function fetchMIPSEmployees(page = 1, size = 50): Promise<{
  employees: MIPSEmployee[];
  total: number;
}> {
  const result = await callMIPSProxy("/admin/person/employees/page", "GET", {
    page: String(page),
    size: String(size),
  });

  if (!result.success || result.data?.code !== 200) {
    throw new Error(result.data?.message || "Failed to fetch MIPS employees");
  }

  const content = result.data?.data?.content || [];
  const total = result.data?.data?.totalElements || 0;
  return { employees: Array.isArray(content) ? content as MIPSEmployee[] : [], total: total as number };
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

// Remote open door via MIPS — uses PUT /admin/devices/remote/opendoor with numeric device ids
export async function remoteOpenDoor(deviceId: number): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy("/admin/devices/remote/opendoor", "PUT", undefined, { ids: [deviceId] }, "json");
    const isOk = result.success && result.data?.code === 200;
    return {
      success: isOk,
      message: isOk ? "Door opened successfully" : (result.data?.message || result.data?.msg || "Failed to open door"),
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Restart device via MIPS — uses PUT /admin/devices/remote/restart with numeric device ids
export async function restartDevice(deviceId: number): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy("/admin/devices/remote/restart", "PUT", undefined, { ids: [deviceId] }, "json");
    const isOk = result.success && result.data?.code === 200;
    return {
      success: isOk,
      message: isOk ? "Device restarting..." : (result.data?.message || result.data?.msg || "Failed to restart device"),
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Capture face photo via MIPS device camera
export async function capturePhoto(
  personMipsId: number,
  deviceId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy(
      "/admin/person/employees/take_photo",
      "POST",
      undefined,
      { ids: [personMipsId], deviceIds: [deviceId] },
      "json"
    );
    const isOk = result.success && result.data?.code === 200;
    return {
      success: isOk,
      message: isOk
        ? "Photo capture triggered on device"
        : (result.data?.message || result.data?.msg || "Failed to capture photo"),
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
    const result = await callMIPSProxy(
      "/admin/person/employees/permission",
      "POST",
      undefined,
      { dealWithType: 1, ids: [String(personMipsId)], deviceIds, passTimes: [], passDealType: 1 },
      "json"
    );
    const isOk = result.success && result.data?.code === 200;
    return {
      success: isOk,
      message: isOk
        ? "Permission assigned successfully"
        : (result.data?.message || result.data?.msg || "Failed to assign permission"),
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Fetch online device IDs from MIPS
export async function fetchOnlineDeviceIds(): Promise<number[]> {
  const result = await callMIPSProxy("/admin/devices/list/online", "GET");
  if (!result.success || result.data?.code !== 200) return [];
  const data = result.data?.data;
  if (Array.isArray(data)) {
    return data.map((d: any) => Number(d.id)).filter((id) => !isNaN(id));
  }
  return [];
}

/** Strip hyphens for MIPS search matching */
function stripHyphens(code: string): string {
  return code.replace(/-/g, "");
}

// Manual sync test — syncs one person and verifies in MIPS roster
export async function manualSyncTest(
  personType: "member" | "employee",
  personId: string,
  personNo: string,
  branchId?: string
): Promise<{ syncResult: any; verifyResult: any; verified: boolean }> {
  // Step 1: Sync
  const syncResult = await syncPersonToMIPS(personType, personId, branchId);

  // Step 2: Verify by querying MIPS employees list (search with stripped hyphens)
  const strippedNo = stripHyphens(personNo);
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
