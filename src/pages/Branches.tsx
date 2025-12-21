import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Building2, Pencil } from 'lucide-react';
import { useBranches } from '@/hooks/useBranches';
import { AddBranchDialog } from '@/components/branches/AddBranchDialog';
import { EditBranchDrawer } from '@/components/branches/EditBranchDrawer';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function BranchesPage() {
  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<any>(null);
  const { data: branches = [], isLoading } = useBranches();
  const { hasAnyRole } = useAuth();

  const canCreateBranch = hasAnyRole(['owner', 'admin']);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Branches</h1>
          <Button
            onClick={() => {
              if (!canCreateBranch) {
                toast.error('Only Owner/Admin can create branches');
                return;
              }
              setAddBranchOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Branch
          </Button>
          <AddBranchDialog open={addBranchOpen} onOpenChange={setAddBranchOpen} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Branches</CardTitle>
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
                    <TableHead>Branch</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch: any) => (
                    <TableRow key={branch.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div className="font-medium">{branch.name}</div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{branch.code}</TableCell>
                      <TableCell>
                        <div className="text-sm">{branch.city}, {branch.state}</div>
                        <div className="text-sm text-muted-foreground">{branch.address}</div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{branch.phone}</div>
                        <div className="text-sm text-muted-foreground">{branch.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge className={branch.is_active ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}>
                          {branch.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditBranch(branch)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {branches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No branches found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <EditBranchDrawer
          open={!!editBranch}
          onOpenChange={(open) => !open && setEditBranch(null)}
          branch={editBranch}
        />
      </div>
    </AppLayout>
  );
}
