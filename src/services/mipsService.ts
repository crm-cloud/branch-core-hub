import { supabase } from "@/integrations/supabase/client";

export interface MIPSDevice {
  id: string;
  deviceKey: string;
  deviceName: string;
  deviceIp: string;
  personCount: number;
  faceCount: number;
  fpCount: number;
  status: number; // 1 = online, 0 = offline
  lastActiveTime: string;
}

export interface MIPSPassRecord {
  id: string;
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

export interface MIPSProxyResponse<T = unknown> {
  success: boolean;
  status: number;
  data: {
    code: number;
    msg: string;
    data: T;
    page?: { totalCount: number; totalPage: number; currentPage: number };
  };
  error?: string;
}

async function callMIPSProxy<T = unknown>(
  endpoint: string,
  method = "GET",
  params?: Record<string, string>,
  data?: Record<string, unknown>
): Promise<MIPSProxyResponse<T>> {
  const { data: result, error } = await supabase.functions.invoke("mips-proxy", {
    body: { endpoint, method, params, data },
  });

  if (error) throw new Error(error.message || "MIPS proxy call failed");
  return result as MIPSProxyResponse<T>;
}

// Test connection by generating a token
export async function testMIPSConnection(): Promise<{ success: boolean; message: string; raw?: unknown }> {
  try {
    const result = await callMIPSProxy("/admin/devices/page", "GET", { page: "1", size: "1" });
    return {
      success: result.success && (result.data?.code === 200 || result.data?.code === 0),
      message: result.success ? "Connected to MIPS server" : `Connection failed: ${JSON.stringify(result.data)}`,
      raw: result.data,
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Fetch devices from MIPS
export async function fetchMIPSDevices(): Promise<MIPSDevice[]> {
  const result = await callMIPSProxy<{ list: MIPSDevice[] }>("/admin/devices/page", "GET", {
    page: "1",
    size: "100",
  });

  if (!result.success) throw new Error("Failed to fetch MIPS devices");
  
  const list = result.data?.data?.list || result.data?.data || [];
  return Array.isArray(list) ? list : [];
}

// Fetch pass records from MIPS  
export async function fetchMIPSPassRecords(page = 1, size = 20): Promise<{
  records: MIPSPassRecord[];
  total: number;
}> {
  const result = await callMIPSProxy<{ list: MIPSPassRecord[] }>("/admin/pass/pass_records/page", "GET", {
    page: String(page),
    size: String(size),
  });

  if (!result.success) throw new Error("Failed to fetch MIPS pass records");
  
  const list = result.data?.data?.list || result.data?.data || [];
  const total = result.data?.page?.totalCount || 0;
  return { records: Array.isArray(list) ? list : [], total };
}

// Fetch employees from MIPS
export async function fetchMIPSEmployees(page = 1, size = 50): Promise<{
  employees: unknown[];
  total: number;
}> {
  const result = await callMIPSProxy<{ list: unknown[] }>("/admin/person/employees/page", "GET", {
    page: String(page),
    size: String(size),
  });

  if (!result.success) throw new Error("Failed to fetch MIPS employees");

  const list = result.data?.data?.list || result.data?.data || [];
  const total = result.data?.page?.totalCount || 0;
  return { employees: Array.isArray(list) ? list : [], total };
}

// Sync a person to MIPS
export async function syncPersonToMIPS(
  personType: "member" | "employee",
  personId: string,
  branchId?: string
): Promise<{ success: boolean; mips_person_id?: string; error?: string; mips_response?: unknown }> {
  const { data, error } = await supabase.functions.invoke("sync-to-mips", {
    body: { person_type: personType, person_id: personId, branch_id: branchId },
  });

  if (error) throw new Error(error.message || "Sync failed");
  return data;
}

// Remote open door via MIPS
export async function remoteOpenDoor(deviceKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy("/admin/devices/openDoor", "POST", undefined, {
      deviceKey,
    });
    return {
      success: result.success,
      message: result.success ? "Door opened successfully" : "Failed to open door",
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}

// Restart device via MIPS
export async function restartDevice(deviceKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const result = await callMIPSProxy("/admin/devices/restart", "POST", undefined, {
      deviceKey,
    });
    return {
      success: result.success,
      message: result.success ? "Device restarting..." : "Failed to restart device",
    };
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : String(e) };
  }
}
