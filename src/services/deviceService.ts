import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface AccessDevice {
  id: string;
  branch_id: string;
  device_name: string;
  ip_address: string;
  mac_address?: string | null;
  device_type: string;
  model?: string | null;
  firmware_version?: string | null;
  serial_number?: string | null;
  relay_mode?: number | null;
  relay_delay?: number | null;
  is_online?: boolean | null;
  last_heartbeat?: string | null;
  last_sync?: string | null;
  config?: Json | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface DeviceAccessEvent {
  id: string;
  device_id?: string | null;
  branch_id: string;
  member_id?: string | null;
  staff_id?: string | null;
  event_type: string;
  access_granted: boolean;
  denial_reason?: string | null;
  confidence_score?: number | null;
  photo_url?: string | null;
  response_sent?: string | null;
  device_message?: string | null;
  processed_at?: string | null;
  created_at?: string | null;
  device?: AccessDevice | null;
  member?: {
    member_code: string;
    user_id: string;
  } | null;
}

export const fetchDevices = async (branchId?: string): Promise<AccessDevice[]> => {
  let query = supabase
    .from('access_devices')
    .select('*')
    .order('device_name');

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return (data || []) as AccessDevice[];
};

export const fetchDevice = async (deviceId: string): Promise<AccessDevice | null> => {
  const { data, error } = await supabase
    .from('access_devices')
    .select('*')
    .eq('id', deviceId)
    .maybeSingle();

  if (error) throw error;
  return data as AccessDevice | null;
};

export const addDevice = async (device: {
  branch_id: string;
  device_name: string;
  ip_address: string;
  mac_address?: string;
  device_type?: string;
  model?: string;
  serial_number?: string;
  relay_mode?: number;
  relay_delay?: number;
}): Promise<AccessDevice> => {
  const { data, error } = await supabase
    .from('access_devices')
    .insert({
      branch_id: device.branch_id,
      device_name: device.device_name,
      ip_address: device.ip_address as unknown,
      mac_address: device.mac_address,
      device_type: device.device_type || 'turnstile',
      model: device.model,
      serial_number: device.serial_number,
      relay_mode: device.relay_mode,
      relay_delay: device.relay_delay,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as AccessDevice;
};

export const updateDevice = async (id: string, updates: {
  device_name?: string;
  ip_address?: string;
  mac_address?: string;
  branch_id?: string;
  device_type?: string;
  model?: string;
  serial_number?: string;
  relay_mode?: number;
  relay_delay?: number;
}): Promise<AccessDevice> => {
  const updateData: Record<string, unknown> = {};
  if (updates.device_name) updateData.device_name = updates.device_name;
  if (updates.ip_address) updateData.ip_address = updates.ip_address as unknown;
  if (updates.mac_address !== undefined) updateData.mac_address = updates.mac_address;
  if (updates.branch_id) updateData.branch_id = updates.branch_id;
  if (updates.device_type) updateData.device_type = updates.device_type;
  if (updates.model !== undefined) updateData.model = updates.model;
  if (updates.serial_number !== undefined) updateData.serial_number = updates.serial_number;
  if (updates.relay_mode !== undefined) updateData.relay_mode = updates.relay_mode;
  if (updates.relay_delay !== undefined) updateData.relay_delay = updates.relay_delay;
  
  const { data, error } = await supabase
    .from('access_devices')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as AccessDevice;
};

export const deleteDevice = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('access_devices')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const triggerRelay = async (deviceId: string): Promise<{ success: boolean; message: string }> => {
  const { data, error } = await supabase.functions.invoke('device-trigger-relay', {
    body: { device_id: deviceId },
  });

  if (error) throw error;
  return data;
};

export const fetchAccessEvents = async (
  branchId?: string,
  limit: number = 50,
  filters?: {
    eventType?: string;
    accessGranted?: boolean;
    startDate?: string;
    endDate?: string;
  }
): Promise<DeviceAccessEvent[]> => {
  let query = supabase
    .from('device_access_events')
    .select(`
      *,
      device:access_devices(device_name, ip_address),
      member:members(member_code, user_id)
    `)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  if (filters?.eventType) {
    query = query.eq('event_type', filters.eventType);
  }

  if (filters?.accessGranted !== undefined) {
    query = query.eq('access_granted', filters.accessGranted);
  }

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  const { data, error } = await query;
  
  if (error) throw error;
  return (data || []) as DeviceAccessEvent[];
};

export const subscribeToAccessEvents = (
  branchId: string,
  callback: (event: DeviceAccessEvent) => void
) => {
  const channel = supabase
    .channel('device_access_events_realtime')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'device_access_events',
        filter: `branch_id=eq.${branchId}`,
      },
      (payload) => {
        callback(payload.new as DeviceAccessEvent);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const sendDeviceCommand = async (
  deviceId: string,
  commandType: string = 'relay_open',
  payload: Record<string, unknown> = { duration: 5 }
): Promise<{ id: string }> => {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('device_commands')
    .insert({
      device_id: deviceId,
      command_type: commandType,
      payload: payload as Json,
      issued_by: user?.id || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
};

export const subscribeToCommandStatus = (
  commandId: string,
  callback: (status: string, executedAt?: string) => void
) => {
  const channel = supabase
    .channel(`device_command_${commandId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'device_commands',
        filter: `id=eq.${commandId}`,
      },
      (payload) => {
        const row = payload.new as { status: string; executed_at?: string };
        callback(row.status, row.executed_at || undefined);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const getDeviceStats = async (branchId?: string) => {
  const devices = await fetchDevices(branchId);
  
  const online = devices.filter(d => d.is_online).length;
  const offline = devices.length - online;
  
  return {
    total: devices.length,
    online,
    offline,
    byType: devices.reduce((acc, d) => {
      acc[d.device_type] = (acc[d.device_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };
};
