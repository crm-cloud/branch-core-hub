import { supabase } from "@/integrations/supabase/client";

export interface BiometricSyncItem {
  id: string;
  member_id?: string;
  staff_id?: string;
  device_id?: string;
  sync_type: 'add' | 'update' | 'delete';
  photo_url: string;
  person_uuid: string;
  person_name: string;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  retry_count: number;
  error_message?: string;
  queued_at?: string;
  processed_at?: string;
}

export const queueMemberSync = async (
  memberId: string,
  photoUrl: string,
  personName: string,
  deviceIds?: string[]
): Promise<BiometricSyncItem[]> => {
  // Get all devices if no specific devices provided
  let targetDevices: string[] = deviceIds || [];
  
  if (!deviceIds || deviceIds.length === 0) {
    const { data: devices } = await supabase
      .from('access_devices')
      .select('id')
      .eq('device_type', 'face_terminal');
    
    targetDevices = devices?.map(d => d.id) || [];
  }

  if (targetDevices.length === 0) {
    throw new Error('No face recognition devices found');
  }

  const syncItems = targetDevices.map(deviceId => ({
    member_id: memberId,
    device_id: deviceId,
    sync_type: 'add' as const,
    photo_url: photoUrl,
    person_uuid: memberId,
    person_name: personName,
    status: 'pending' as const,
    retry_count: 0,
  }));

  const { data, error } = await supabase
    .from('biometric_sync_queue')
    .upsert(syncItems, { onConflict: 'member_id,device_id' })
    .select();

  if (error) throw error;
  
  // Update member's biometric status
  await supabase
    .from('members')
    .update({ 
      biometric_photo_url: photoUrl,
      biometric_enrolled: false // Will be set to true when sync completes
    })
    .eq('id', memberId);

  return (data || []) as BiometricSyncItem[];
};

export const queueStaffSync = async (
  staffId: string,
  photoUrl: string,
  personName: string,
  deviceIds?: string[]
): Promise<BiometricSyncItem[]> => {
  let targetDevices: string[] = deviceIds || [];
  
  if (!deviceIds || deviceIds.length === 0) {
    const { data: devices } = await supabase
      .from('access_devices')
      .select('id')
      .eq('device_type', 'face_terminal');
    
    targetDevices = devices?.map(d => d.id) || [];
  }

  if (targetDevices.length === 0) {
    throw new Error('No face recognition devices found');
  }

  const syncItems = targetDevices.map(deviceId => ({
    staff_id: staffId,
    device_id: deviceId,
    sync_type: 'add' as const,
    photo_url: photoUrl,
    person_uuid: staffId,
    person_name: personName,
    status: 'pending' as const,
    retry_count: 0,
  }));

  const { data, error } = await supabase
    .from('biometric_sync_queue')
    .upsert(syncItems, { onConflict: 'staff_id,device_id' })
    .select();

  if (error) throw error;
  
  // Update employee's biometric status
  await supabase
    .from('employees')
    .update({ 
      biometric_photo_url: photoUrl,
      biometric_enrolled: false
    })
    .eq('id', staffId);

  return (data || []) as BiometricSyncItem[];
};

export const getSyncStatus = async (
  personId: string,
  type: 'member' | 'staff'
): Promise<BiometricSyncItem[]> => {
  const column = type === 'member' ? 'member_id' : 'staff_id';
  
  const { data, error } = await supabase
    .from('biometric_sync_queue')
    .select('*')
    .eq(column, personId)
    .order('queued_at', { ascending: false });

  if (error) throw error;
  return (data || []) as BiometricSyncItem[];
};

export const removeBiometricData = async (
  personId: string,
  type: 'member' | 'staff',
  deviceIds?: string[]
): Promise<void> => {
  const column = type === 'member' ? 'member_id' : 'staff_id';
  
  let query = supabase
    .from('biometric_sync_queue')
    .update({ sync_type: 'delete', status: 'pending' })
    .eq(column, personId);

  if (deviceIds && deviceIds.length > 0) {
    query = query.in('device_id', deviceIds);
  }

  const { error } = await query;
  if (error) throw error;

  // Update enrollment status
  const table = type === 'member' ? 'members' : 'employees';
  await supabase
    .from(table)
    .update({ biometric_enrolled: false })
    .eq('id', personId);
};

export const getPendingSyncItems = async (deviceId?: string): Promise<BiometricSyncItem[]> => {
  let query = supabase
    .from('biometric_sync_queue')
    .select('*')
    .eq('status', 'pending')
    .order('queued_at');

  if (deviceId) {
    query = query.eq('device_id', deviceId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as BiometricSyncItem[];
};

export const markSyncComplete = async (
  syncId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> => {
  const updates: Partial<BiometricSyncItem> = {
    status: success ? 'completed' : 'failed',
    processed_at: new Date().toISOString(),
  };

  if (!success && errorMessage) {
    updates.error_message = errorMessage;
    // Increment retry count on failure
    const { data: current } = await supabase
      .from('biometric_sync_queue')
      .select('retry_count, member_id, staff_id')
      .eq('id', syncId)
      .single();
    
    if (current) {
      updates.retry_count = (current.retry_count || 0) + 1;
    }
  }

  const { error } = await supabase
    .from('biometric_sync_queue')
    .update(updates)
    .eq('id', syncId);

  if (error) throw error;

  // If successful, update the person's enrollment status
  if (success) {
    const { data: syncItem } = await supabase
      .from('biometric_sync_queue')
      .select('member_id, staff_id')
      .eq('id', syncId)
      .single();

    if (syncItem?.member_id) {
      await supabase
        .from('members')
        .update({ biometric_enrolled: true })
        .eq('id', syncItem.member_id);
    } else if (syncItem?.staff_id) {
      await supabase
        .from('employees')
        .update({ biometric_enrolled: true })
        .eq('id', syncItem.staff_id);
    }
  }
};

export const getBiometricStats = async (branchId?: string) => {
  // Get member enrollment stats
  let memberQuery = supabase
    .from('members')
    .select('biometric_enrolled');
  
  if (branchId) {
    memberQuery = memberQuery.eq('branch_id', branchId);
  }

  const { data: members } = await memberQuery;
  
  const enrolledMembers = members?.filter(m => m.biometric_enrolled).length || 0;
  const totalMembers = members?.length || 0;

  // Get pending sync count
  const { count: pendingCount } = await supabase
    .from('biometric_sync_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  return {
    enrolledMembers,
    totalMembers,
    enrollmentRate: totalMembers > 0 ? Math.round((enrolledMembers / totalMembers) * 100) : 0,
    pendingSyncs: pendingCount || 0,
  };
};
