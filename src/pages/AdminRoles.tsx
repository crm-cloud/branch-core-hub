import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Shield,
  Search,
  Loader2,
  AlertCircle,
  MoreHorizontal,
  UserPlus,
  UserX,
  Eye,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

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

const TAB_FILTERS: Record<string, AppRole | null> = {
  all: null,
  admins: 'admin',
  trainers: 'trainer',
  staff: 'staff',
};

export default function AdminRoles() {
  const { hasAnyRole } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<AppRole | ''>('');
  const [removeConfirm, setRemoveConfirm] = useState<{ userId: string; role: AppRole } | null>(null);

  const canManageRoles = hasAnyRole(['owner', 'admin']);

  const { data: usersWithRoles = [], isLoading } = useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, phone')
        .order('full_name');
      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');
      if (rolesError) throw rolesError;

      const { data: staffBranches } = await supabase
        .from('staff_branches')
        .select('user_id, branch_id, branches(name)');

      return profiles?.map(profile => ({
        ...profile,
        roles: roles?.filter(r => r.user_id === profile.id).map(r => r.role as AppRole) || [],
        branch: (staffBranches as any[])?.find(sb => sb.user_id === profile.id)?.branches?.name || null,
      })) || [];
    },
  });

  const addRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Role added successfully');
      setSheetOpen(false);
      setSelectedUserId(null);
      setNewRole('');
    },
    onError: (error: any) => toast.error('Failed to add role: ' + error.message),
  });

  const removeRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users-with-roles'] });
      toast.success('Role removed');
      setRemoveConfirm(null);
    },
    onError: (error: any) => toast.error('Failed to remove role: ' + error.message),
  });

  const filteredUsers = usersWithRoles.filter(user => {
    const matchesSearch =
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.phone?.toLowerCase().includes(searchQuery.toLowerCase());
    const tabRole = TAB_FILTERS[activeTab];
    const matchesTab = !tabRole || user.roles.includes(tabRole);
    return matchesSearch && matchesTab;
  });

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
        <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/10">
              <Shield className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">User Roles Management</h1>
              <p className="text-white/70 text-sm">Manage access, assign roles, and control permissions</p>
            </div>
          </div>
        </div>

        {/* Role Summary Cards */}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-6">
          {ROLE_OPTIONS.map((role) => {
            const count = usersWithRoles.filter(u => u.roles.includes(role)).length;
            return (
              <Card
                key={role}
                className={`rounded-xl shadow-md cursor-pointer transition-all hover:shadow-lg ${activeTab === role ? 'ring-2 ring-primary' : ''}`}
                onClick={() => setActiveTab(activeTab === role ? 'all' : role)}
              >
                <CardContent className="pt-4 pb-4 text-center">
                  <p className="text-2xl font-bold">{count}</p>
                  <p className="text-sm text-muted-foreground capitalize">{role}s</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Search + Tabs */}
        <Card className="rounded-xl shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="all">All Users</TabsTrigger>
                  <TabsTrigger value="admins">Admins</TabsTrigger>
                  <TabsTrigger value="trainers">Trainers</TabsTrigger>
                  <TabsTrigger value="staff">Staff</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-muted-foreground text-center py-12">No users found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Roles</TableHead>
                      <TableHead className="hidden md:table-cell">Branch</TableHead>
                      <TableHead className="hidden md:table-cell">Phone</TableHead>
                      <TableHead className="hidden md:table-cell">Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/50">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                              {(user.full_name || 'U')[0].toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{user.full_name || 'Unnamed'}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {user.roles.length === 0 ? (
                              <span className="text-muted-foreground text-xs">No roles</span>
                            ) : (
                              user.roles.map((role) => (
                                <Badge key={role} variant="outline" className={`capitalize text-xs ${ROLE_COLORS[role]}`}>
                                  {role}
                                </Badge>
                              ))
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {user.branch || '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {user.phone || '—'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={user.roles.length > 0 ? 'default' : 'secondary'} className="text-xs">
                            {user.roles.length > 0 ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedUserId(user.id); setSheetOpen(true); }}>
                                <UserPlus className="h-4 w-4 mr-2" /> Assign Role
                              </DropdownMenuItem>
                              {user.roles.map(role => (
                                <DropdownMenuItem
                                  key={role}
                                  className="text-destructive"
                                  onClick={() => setRemoveConfirm({ userId: user.id, role })}
                                >
                                  <UserX className="h-4 w-4 mr-2" /> Remove {role}
                                </DropdownMenuItem>
                              ))}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => navigate(`/members`)}>
                                <Eye className="h-4 w-4 mr-2" /> View Profile
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assign Role Sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Assign Role</SheetTitle>
              <SheetDescription>
                Add a new role to {selectedUser?.full_name || selectedUser?.email}
              </SheetDescription>
            </SheetHeader>
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <Label>Select Role</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role} value={role} className="capitalize">{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedUser && selectedUser.roles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Current Roles</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedUser.roles.map(r => (
                      <Badge key={r} variant="outline" className={`capitalize text-xs ${ROLE_COLORS[r]}`}>{r}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <SheetFooter>
              <Button variant="outline" onClick={() => setSheetOpen(false)}>Cancel</Button>
              <Button
                onClick={() => { if (selectedUserId && newRole) addRoleMutation.mutate({ userId: selectedUserId, role: newRole }); }}
                disabled={!newRole || addRoleMutation.isPending}
              >
                {addRoleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Add Role
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        {/* Remove Role Confirm */}
        <AlertDialog open={!!removeConfirm} onOpenChange={(open) => { if (!open) setRemoveConfirm(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Role</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the "{removeConfirm?.role}" role? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => { if (removeConfirm) removeRoleMutation.mutate(removeConfirm); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
