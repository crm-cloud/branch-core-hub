import { supabase } from '@/integrations/supabase/client';

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Task {
  id: string;
  branch_id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  assigned_to: string | null;
  assigned_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function fetchTasks(branchId?: string, status?: TaskStatus) {
  let query = supabase
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  if (branchId) {
    query = query.eq('branch_id', branchId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Fetch profiles for assigned users
  const userIds = [...new Set([
    ...(data?.map(t => t.assigned_to).filter(Boolean) || []),
    ...(data?.map(t => t.assigned_by).filter(Boolean) || [])
  ])];

  let profiles: any[] = [];
  if (userIds.length > 0) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds);
    profiles = profileData || [];
  }

  return data?.map(task => ({
    ...task,
    assignee: profiles.find(p => p.id === task.assigned_to) || null,
    assigner: profiles.find(p => p.id === task.assigned_by) || null,
  })) || [];
}

export async function fetchMyTasks(userId: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', userId)
    .neq('status', 'completed')
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true });

  if (error) throw error;
  return data;
}

export async function getTask(id: string) {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return data;
}

export async function createTask(task: {
  branchId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  assignedTo?: string;
  assignedBy?: string;
}) {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      branch_id: task.branchId,
      title: task.title,
      description: task.description,
      priority: task.priority || 'medium',
      status: 'pending',
      due_date: task.dueDate,
      assigned_to: task.assignedTo,
      assigned_by: task.assignedBy,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTask(id: string, updates: Partial<Task>) {
  const { data, error } = await supabase
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function assignTask(taskId: string, userId: string | null, assignedBy: string) {
  const { data, error } = await supabase
    .from('tasks')
    .update({ 
      assigned_to: userId === 'unassigned' ? null : userId,
      assigned_by: assignedBy 
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateTaskStatus(id: string, status: TaskStatus) {
  const updates: Partial<Task> = { status };
  if (status === 'completed') {
    updates.completed_at = new Date().toISOString();
  }
  return updateTask(id, updates);
}

export async function deleteTask(id: string) {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getTaskStats(branchId?: string) {
  const tasks = await fetchTasks(branchId);
  
  const now = new Date();
  const overdueTasks = tasks.filter(t => 
    t.due_date && 
    new Date(t.due_date) < now && 
    t.status !== 'completed' && 
    t.status !== 'cancelled'
  );

  return {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: overdueTasks.length,
    highPriority: tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
  };
}
