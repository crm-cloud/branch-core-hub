import { useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useBranches } from '@/hooks/useBranches';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

const createUserSchema = z.object({
  email: z.string().email('Valid email required'),
  fullName: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'trainer', 'staff', 'member'] as const),
  branchId: z.string().optional(),
});

type CreateUserData = z.infer<typeof createUserSchema>;

const roleLabels: Record<Exclude<AppRole, 'owner'>, string> = {
  admin: 'Admin',
  manager: 'Branch Manager',
  trainer: 'Trainer',
  staff: 'Staff',
  member: 'Member',
};

export default function AdminUsersPage() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { data: branches } = useBranches();

  const form = useForm<CreateUserData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      fullName: '',
      phone: '',
      role: 'member',
      branchId: '',
    },
  });

  const selectedRole = form.watch('role');
  const needsBranch = ['manager', 'trainer', 'staff', 'member'].includes(selectedRole);

  const onSubmit = async (data: CreateUserData) => {
    if (needsBranch && !data.branchId) {
      toast({
        title: 'Branch Required',
        description: 'Please select a branch for this user.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          fullName: data.fullName,
          phone: data.phone,
          role: data.role,
          branchId: data.branchId || null,
        },
      });

      if (error) throw error;
      if (result.error) throw new Error(result.error);

      toast({
        title: 'User Created',
        description: `${data.fullName} will receive login instructions via email.`,
      });

      form.reset();
    } catch (error) {
      toast({
        title: 'Failed to Create User',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Users className="w-8 h-8 text-accent" />
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage user accounts
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <CardTitle>Create New User</CardTitle>
                  <CardDescription>
                    User will set their password on first login
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="user@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Phone (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="+1 234 567 8900" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(roleLabels).map(([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {needsBranch && (
                    <FormField
                      control={form.control}
                      name="branchId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Branch</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select branch" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {branches?.map((branch) => (
                                <SelectItem key={branch.id} value={branch.id}>
                                  {branch.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Creating...' : 'Create User'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>How It Works</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent text-xs font-bold">1</span>
                </div>
                <p>You create a user with their email and role</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent text-xs font-bold">2</span>
                </div>
                <p>User logs in with their email (via OTP or password reset)</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent text-xs font-bold">3</span>
                </div>
                <p>On first login, they must set their permanent password</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-accent text-xs font-bold">4</span>
                </div>
                <p>After that, they can access the system based on their role</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
