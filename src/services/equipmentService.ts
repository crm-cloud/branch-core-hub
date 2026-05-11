import { supabase } from '@/integrations/supabase/client';

export interface Equipment {
  id: string;
  branch_id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  category: string | null;
  primary_category: string | null;
  muscle_groups: string[];
  movement_pattern: string | null;
  location: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  warranty_expiry: string | null;
  status: 'operational' | 'maintenance' | 'out_of_order' | 'retired';
  notes: string | null;
  created_at: string;
}

export interface MaintenanceRecord {
  id: string;
  equipment_id: string;
  maintenance_type: string;
  description: string | null;
  scheduled_date: string | null;
  completed_date: string | null;
  cost: number | null;
  performed_by: string | null;
  notes: string | null;
  created_at: string;
}

export async function fetchEquipment(branchId?: string) {
  let query = supabase
    .from('equipment')
    .select('*')
    .order('name');

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Equipment[];
}

/**
 * Fetch a lightweight list of OPERATIONAL equipment for a branch.
 * Used by the AI plan generator to bias workout exercises toward
 * machines the gym actually owns.
 */
export interface EquipmentLite {
  name: string;
  category: string | null;
  primary_category: string | null;
  muscle_groups: string[];
  movement_pattern: string | null;
  brand: string | null;
  model: string | null;
}

export async function fetchOperationalEquipmentLite(
  branchId?: string | null,
): Promise<EquipmentLite[]> {
  let query = supabase
    .from('equipment')
    .select('name, category, primary_category, muscle_groups, movement_pattern, brand, model, status')
    .eq('status', 'operational')
    .order('name');
  if (branchId) query = query.eq('branch_id', branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r: any) => ({
    name: r.name,
    category: r.category ?? null,
    primary_category: r.primary_category ?? null,
    muscle_groups: Array.isArray(r.muscle_groups) ? r.muscle_groups : [],
    movement_pattern: r.movement_pattern ?? null,
    brand: r.brand ?? null,
    model: r.model ?? null,
  }));
}

export async function getEquipment(id: string) {
  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data as Equipment;
}

export async function createEquipment(equipment: {
  branchId: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  category?: string;
  primaryCategory?: string;
  muscleGroups?: string[];
  movementPattern?: string;
  location?: string;
  purchaseDate?: string;
  purchasePrice?: number;
  warrantyExpiry?: string;
}) {
  const { data, error } = await supabase
    .from('equipment')
    .insert({
      branch_id: equipment.branchId,
      name: equipment.name,
      brand: equipment.brand,
      model: equipment.model,
      serial_number: equipment.serialNumber,
      category: equipment.category,
      primary_category: equipment.primaryCategory ?? null,
      muscle_groups: equipment.muscleGroups ?? [],
      movement_pattern: equipment.movementPattern ?? null,
      location: equipment.location,
      purchase_date: equipment.purchaseDate,
      purchase_price: equipment.purchasePrice,
      warranty_expiry: equipment.warrantyExpiry,
      status: 'operational',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEquipment(id: string, updates: Partial<Equipment>) {
  const { data, error } = await supabase
    .from('equipment')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateEquipmentStatus(id: string, status: Equipment['status']) {
  return updateEquipment(id, { status });
}

/**
 * Hard-delete an equipment row.
 * If maintenance history exists we abort and the caller should
 * fall back to soft-retire (status='retired') to preserve the audit trail.
 */
export async function deleteEquipment(id: string) {
  const { count, error: countErr } = await supabase
    .from('equipment_maintenance')
    .select('id', { count: 'exact', head: true })
    .eq('equipment_id', id);
  if (countErr) throw countErr;
  if ((count ?? 0) > 0) {
    const err: any = new Error('HAS_MAINTENANCE_HISTORY');
    err.code = 'HAS_MAINTENANCE_HISTORY';
    err.maintenanceCount = count;
    throw err;
  }
  const { error } = await supabase.from('equipment').delete().eq('id', id);
  if (error) throw error;
  return { id };
}

export async function bulkDeleteEquipment(ids: string[]) {
  const results = await Promise.allSettled(ids.map((id) => deleteEquipment(id)));
  const ok = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? { id: ids[i], reason: (r.reason as any)?.code || (r.reason as any)?.message } : null))
    .filter(Boolean) as Array<{ id: string; reason: string }>;
  return { ok, failed };
}

export async function fetchMaintenanceRecords(equipmentId?: string, branchId?: string) {
  let query = supabase
    .from('equipment_maintenance')
    .select(`
      *,
      equipment!inner(name, brand, model, branch_id)
    `)
    .order('created_at', { ascending: false });

  if (equipmentId) {
    query = query.eq('equipment_id', equipmentId);
  }
  if (branchId) {
    query = query.eq('equipment.branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createMaintenanceRecord(record: {
  equipmentId: string;
  maintenanceType: string;
  description?: string;
  scheduledDate?: string;
  cost?: number;
  performedBy?: string;
}) {
  const { data, error } = await supabase
    .from('equipment_maintenance')
    .insert({
      equipment_id: record.equipmentId,
      maintenance_type: record.maintenanceType,
      description: record.description,
      scheduled_date: record.scheduledDate,
      cost: record.cost,
      performed_by: record.performedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function completeMaintenanceRecord(id: string, cost?: number, notes?: string) {
  const { data, error } = await supabase
    .from('equipment_maintenance')
    .update({
      completed_date: new Date().toISOString(),
      cost,
      notes,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getEquipmentStats(branchId?: string) {
  const equipment = await fetchEquipment(branchId);
  
  const stats = {
    total: equipment.length,
    operational: equipment.filter(e => e.status === 'operational').length,
    maintenance: equipment.filter(e => e.status === 'maintenance').length,
    outOfOrder: equipment.filter(e => e.status === 'out_of_order').length,
    retired: equipment.filter(e => e.status === 'retired').length,
    totalValue: equipment.reduce((sum, e) => sum + (e.purchase_price || 0), 0),
  };

  return stats;
}

export async function getMaintenanceCostsByMonth(branchId?: string, year?: number) {
  const currentYear = year || new Date().getFullYear();
  
  let query = supabase
    .from('equipment_maintenance')
    .select('cost, completed_date, equipment!inner(branch_id)')
    .not('completed_date', 'is', null)
    .gte('completed_date', `${currentYear}-01-01`)
    .lte('completed_date', `${currentYear}-12-31`);

  if (branchId) {
    query = query.eq('equipment.branch_id', branchId);
  }

  const { data, error } = await query;
  if (error) throw error;

  const costsByMonth: Record<string, number> = {};
  for (let i = 1; i <= 12; i++) {
    costsByMonth[String(i).padStart(2, '0')] = 0;
  }

  data?.forEach((record: any) => {
    if (record.completed_date && record.cost) {
      const month = record.completed_date.substring(5, 7);
      costsByMonth[month] += record.cost;
    }
  });

  return costsByMonth;
}
