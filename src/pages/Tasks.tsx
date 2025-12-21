import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, CheckSquare, Clock, AlertCircle, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchTasks, updateTaskStatus, getTaskStats, type TaskStatus } from '@/services/taskService';
import { useState } from 'react';
import { toast } from 'sonner';
import { AddTaskDrawer } from '@/components/tasks/AddTaskDrawer';

export default function TasksPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => fetchTasks(),
  });

  const { data: stats } = useQuery({
    queryKey: ['task-stats'],
    queryFn: () => getTaskStats(),
  });

  const { data: stats } = useQuery({
    queryKey: ['task-stats'],
    queryFn: () => getTaskStats(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['assignable-users'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name, email');
      return data || [];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('id, name');
      return data || [];
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      toast.success('Task created successfully');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to create task: ' + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => updateTaskStatus(id, status),
    onSuccess: () => {
      toast.success('Task updated');
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-stats'] });
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-500',
      in_progress: 'bg-blue-500/10 text-blue-500',
      completed: 'bg-green-500/10 text-green-500',
      cancelled: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-muted text-muted-foreground',
      medium: 'bg-blue-500/10 text-blue-500',
      high: 'bg-orange-500/10 text-orange-500',
      urgent: 'bg-destructive/10 text-destructive',
    };
    return colors[priority] || 'bg-muted text-muted-foreground';
  };

  const filteredTasks = filterStatus === 'all' 
    ? tasks 
    : tasks.filter((t: any) => t.status === filterStatus);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Task Management</h1>
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Button>
        </div>

        <AddTaskDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  createTaskMutation.mutate({
                    branchId: formData.get('branchId') as string,
                    title: formData.get('title') as string,
                    description: formData.get('description') as string,
                    priority: formData.get('priority') as TaskPriority,
                    dueDate: formData.get('dueDate') as string || undefined,
                    assignedTo: formData.get('assignedTo') as string || undefined,
                    assignedBy: user?.id,
                  });
                }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="branchId">Branch</Label>
                  <Select name="branchId" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select branch" />
                    </SelectTrigger>
                    <SelectContent>
                      {branches.map((branch: any) => (
                        <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input name="title" placeholder="Task title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea name="description" placeholder="Task description..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select name="priority" defaultValue="medium">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dueDate">Due Date</Label>
                    <Input type="date" name="dueDate" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assign To</Label>
                  <Select name="assignedTo">
                    <SelectTrigger>
                      <SelectValue placeholder="Select user" />
                    </SelectTrigger>
                    <SelectContent>
                      {users.map((u: any) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={createTaskMutation.isPending}>
                  {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats?.pending || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{stats?.inProgress || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats?.completed || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats?.overdue || 0}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>All Tasks</CardTitle>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Task</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTasks.map((task: any) => {
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'completed';
                    return (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <CheckSquare className={`h-5 w-5 mt-0.5 ${task.status === 'completed' ? 'text-green-500' : 'text-muted-foreground'}`} />
                            <div>
                              <div className="font-medium">{task.title}</div>
                              {task.description && (
                                <div className="text-sm text-muted-foreground truncate max-w-md">{task.description}</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                        </TableCell>
                        <TableCell>
                          {task.assignee ? (
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {task.assignee.full_name || task.assignee.email}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {task.due_date ? (
                            <div className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : ''}`}>
                              {isOverdue && <AlertCircle className="h-4 w-4" />}
                              {new Date(task.due_date).toLocaleDateString()}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(task.status)}>{task.status.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={task.status}
                            onValueChange={(value) => updateStatusMutation.mutate({ id: task.id, status: value as TaskStatus })}
                          >
                            <SelectTrigger className="w-32 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pending</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                              <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredTasks.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        <CheckSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        No tasks found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
