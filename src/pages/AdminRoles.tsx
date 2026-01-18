import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { 
  Users, 
  Shield, 
  Search, 
  Plus,
  Trash2,
  UserCog,
  AlertCircle
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AppRole = Database['public']['Enums']['app_role'];

const ROLE_OPTIONS: AppRole[] = ['owner', 'admin', 'manager', 'staff', 'trainer', 'member'];

const ROLE_COLORS: Record<AppRole, string> = {
  owner: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  admin: 'bg-red-500/10 text-red-500 border-red-500/20',
  manager: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  staff: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  trainer: 'bg-green-500/10 text-green-500 border-green-500/20',
  member: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

export default function AdminRoles() {
  const { hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [addRoleDialogOpen, setAddRoleDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<AppRole | ''>('');

  const canManageRoles = hasAnyRole(['owner', 'admin']);

  // Fetch all users with their roles
  const { data: usersWithRoles = [], isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url')
        .order('full_name');

      if (profilesError) throw profilesError;

      // Fetch all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      return profiles?.map(profile => ({
        ...profile,
        roles: roles?.filter(r => r.user_id === profile.id).map(r => r.role as AppRole) || []
      })) || [];
    },
  });

  // Add role mutation
  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Role added successfully');
      setAddRoleDialogOpen(false);
      setSelectedUserId(null);
      setNewRole('');
    },
    onError: (error: any) => {
      toast.error('Failed to add role: ' + error.message);
    },
  });

  // Remove role mutation
  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Role removed successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to remove role: ' + error.message);
    },
  });

  // Filter users
  const filteredUsers = usersWithRoles.filter(user => {
    const matchesSearch = 
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRole = roleFilter === 'all' || user.roles.includes(roleFilter as AppRole);
    
    return matchesSearch && matchesRole;
  });

  const openAddRoleDialog = (userId: string) => {
    setSelectedUserId(userId);
    setAddRoleDialogOpen(true);
  };

  const handleAddRole = () => {
    if (selectedUserId && newRole) {
      addRoleMutation.mutate({ userId: selectedUserId, role: newRole });
    }
  };

  const handleRemoveRole = (userId: string, role: AppRole) => {
    removeRoleMutation.mutate({ userId, role });
  };

  const selectedUser = usersWithRoles.find(u => u.id === selectedUserId);
  const availableRoles = selectedUser 
    ? ROLE_OPTIONS.filter(r => !selectedUser.roles.includes(r))
    : ROLE_OPTIONS;

  if (!canManageRoles) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertCircle className="h-12 w-12 text-warning" />
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">Only owners and admins can manage user roles.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8 text-accent" />
              User Roles Management
            </h1>
            <p className="text-muted-foreground">
              Manage user roles and permissions
            </p>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  {ROLE_OPTIONS.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Role Summary */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
          {ROLE_OPTIONS.map((role) => {
            const count = usersWithRoles.filter(u => u.roles.includes(role)).length;
            return (
              <Card 
                key={role} 
                className={`border-border/50 cursor-pointer transition-colors ${
                  roleFilter === role ? 'ring-2 ring-accent' : ''
                }`}
                onClick={() => setRoleFilter(roleFilter === role ? 'all' : role)}
              >
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground capitalize">{role}s</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Users Table */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Users ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No users found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.full_name || 'Unnamed User'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length === 0 ? (
                              <span className="text-muted-foreground text-sm">No roles</span>
                            ) : (
                              user.roles.map((role) => (
                                <Badge 
                                  key={role} 
                                  variant="outline" 
                                  className={`capitalize ${ROLE_COLORS[role]}`}
                                >
                                  {role}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <button className="ml-1 hover:text-destructive">
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Remove Role</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to remove the "{role}" role from {user.full_name || user.email}? 
                                          This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleRemoveRole(user.id, role)}
                                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                          Remove
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAddRoleDialog(user.id)}
                            disabled={user.roles.length >= ROLE_OPTIONS.length}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Role
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Role Dialog */}
        <Dialog open={addRoleDialogOpen} onOpenChange={setAddRoleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Role</DialogTitle>
              <DialogDescription>
                Add a new role to {selectedUser?.full_name || selectedUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Label className="mb-2 block">Select Role</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a role" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role} className="capitalize">
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddRoleDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddRole} 
                disabled={!newRole || addRoleMutation.isPending}
              >
                {addRoleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={`text-sm font-medium ${className || ''}`}>{children}</label>;
}
