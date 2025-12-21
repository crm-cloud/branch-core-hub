import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createTask, type TaskPriority } from '@/services/taskService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface AddTaskDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddTaskDrawer({ open, onOpenChange }: AddTaskDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to create task: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
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
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New Task</SheetTitle>
          <SheetDescription>Add a new task and assign it to team members</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="branchId">Branch *</Label>
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
            <Label htmlFor="title">Title *</Label>
            <Input name="title" placeholder="Task title" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea name="description" placeholder="Task description..." rows={3} />
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
                <SelectValue placeholder="Select user (optional)" />
              </SelectTrigger>
              <SelectContent>
                {users.map((u: any) => (
                  <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
