import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Database, 
  Users, 
  Dumbbell, 
  Calendar, 
  Package, 
  ShoppingCart, 
  ClipboardList,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Sparkles,
  UserCheck,
  Trophy,
  Lock,
  Megaphone,
  Utensils,
  Trash2
} from 'lucide-react';

interface SeedResult {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    branch: string;
    summary: Record<string, number>;
    credentials: {
      password: string;
      users: { email: string; role: string; name: string }[];
    };
  };
}

const dataCategories = [
  { key: 'branch', icon: Building2, label: 'Branch & Settings', description: 'Main branch with complete configuration' },
  { key: 'users', icon: Users, label: 'Users & Roles', description: 'Owner, Manager, Staff, Trainers, Members' },
  { key: 'benefits', icon: Sparkles, label: 'Benefit Types', description: 'Ice Bath, Sauna, Steam Room, Pool, Spa, etc.' },
  { key: 'plans', icon: ClipboardList, label: 'Membership Plans', description: '6 plans: Basic, Premium, Quarterly, Annual, Elite' },
  { key: 'pt', icon: Dumbbell, label: 'PT Packages', description: '5, 10, 20, 30 session packages' },
  { key: 'classes', icon: Calendar, label: 'Classes', description: 'Yoga, HIIT, Spin, Zumba, Pilates, Boxing, CrossFit' },
  { key: 'equipment', icon: Package, label: 'Equipment', description: '15+ gym equipment with maintenance records' },
  { key: 'products', icon: ShoppingCart, label: 'Products', description: 'Supplements, Apparel, Accessories, Beverages' },
  { key: 'leads', icon: UserCheck, label: 'Leads', description: '5 leads in various pipeline stages' },
  { key: 'diet', icon: Utensils, label: 'Diet Templates', description: 'Weight Loss, Muscle Gain, Maintenance plans' },
  { key: 'lockers', icon: Lock, label: 'Lockers', description: '20 lockers (Small, Medium, Large)' },
  { key: 'attendance', icon: Trophy, label: 'Attendance', description: '7 days of check-in/out records' },
  { key: 'announcements', icon: Megaphone, label: 'Announcements', description: 'Sample gym announcements' },
  { key: 'tasks', icon: ClipboardList, label: 'Tasks', description: 'Staff tasks with priorities' },
];

export function DemoDataSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(dataCategories.map(c => c.key));

  const toggleCategory = (key: string) => {
    setSelectedCategories(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const selectAll = () => setSelectedCategories(dataCategories.map(c => c.key));
  const selectNone = () => setSelectedCategories([]);

  const handleLoadDemoData = async () => {
    if (selectedCategories.length === 0) {
      toast.error('Please select at least one category');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('seed-test-data', {
        body: { categories: selectedCategories },
      });

      if (error) throw error;

      setResult(data as SeedResult);
      
      if (data.success) {
        toast.success('Demo data loaded successfully!');
      } else {
        toast.error(data.error || 'Failed to load demo data');
      }
    } catch (error: any) {
      console.error('Error loading demo data:', error);
      toast.error(error.message || 'Failed to load demo data');
      setResult({ success: false, error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetAllData = async () => {
    if (resetConfirmText !== 'RESET') return;
    
    setShowResetDialog(false);
    setIsResetting(true);
    setResetConfirmText('');

    try {
      const { data, error } = await supabase.functions.invoke('reset-all-data', {
        body: { full_reset: false },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(data.message || `All data reset successfully! ${data.tables_cleared} tables cleared.`);
        setResult(null);
      } else {
        toast.error(data?.error || 'Failed to reset data');
      }
    } catch (error: any) {
      console.error('Error resetting data:', error);
      toast.error(error.message || 'Failed to reset data');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Reset All Data Card */}
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Reset All Data
          </CardTitle>
          <CardDescription>
            Clear all data from the database to start fresh. User accounts, roles, and branches will be preserved.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Danger Zone</p>
              <p className="text-sm text-muted-foreground">
                This will permanently delete all members, memberships, invoices, payments, attendance records, 
                and all other operational data. This action cannot be undone.
              </p>
            </div>
          </div>
          <Button
            variant="destructive"
            onClick={() => setShowResetDialog(true)}
            disabled={isResetting}
            size="lg"
            className="w-full"
          >
            {isResetting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Resetting All Data...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Reset All Data
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Load Demo Data
          </CardTitle>
          <CardDescription>
            Select which categories to import. Branch & Users are required dependencies for most other categories.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selection Controls */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={selectAll}>Select All</Button>
            <Button variant="outline" size="sm" onClick={selectNone}>Deselect All</Button>
            <Badge variant="secondary" className="ml-auto">
              {selectedCategories.length}/{dataCategories.length} selected
            </Badge>
          </div>

          {/* Category Checkboxes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {dataCategories.map((cat) => {
              const isSelected = selectedCategories.includes(cat.key);
              return (
                <label
                  key={cat.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    isSelected 
                      ? 'bg-primary/5 border-primary/30' 
                      : 'bg-muted/30 border-border hover:bg-muted/50'
                  }`}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleCategory(cat.key)}
                    className="mt-0.5"
                  />
                  <cat.icon className={`h-4 w-4 mt-0.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="text-sm font-medium">{cat.label}</p>
                    <p className="text-xs text-muted-foreground">{cat.description}</p>
                  </div>
                </label>
              );
            })}
          </div>

          <Separator />

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-500">Important Note</p>
              <p className="text-sm text-muted-foreground">
                This will create sample data in your database. Existing data with the same identifiers will be skipped.
                This is intended for testing and demonstration purposes.
              </p>
            </div>
          </div>

          {/* Action Button */}
          <Button 
            onClick={handleLoadDemoData} 
            disabled={isLoading || selectedCategories.length === 0}
            size="lg"
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading Demo Data...
              </>
            ) : (
              <>
                <Database className="h-4 w-4 mr-2" />
                Load Selected Demo Data ({selectedCategories.length} categories)
              </>
            )}
          </Button>

          {/* Results */}
          {result && (
            <Card className={result.success ? 'border-green-500/50' : 'border-red-500/50'}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {result.success ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                      <span className="text-green-500">Demo Data Loaded Successfully</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      <span className="text-red-500">Failed to Load Demo Data</span>
                    </>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.success && result.data ? (
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-sm font-medium mb-2">Created Data Summary:</h4>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {Object.entries(result.data.summary).map(([key, value]) => (
                          <div key={key} className="text-center p-2 rounded bg-muted">
                            <p className="text-lg font-bold">{value}</p>
                            <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="text-sm font-medium mb-2">Test Credentials:</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        Password for all accounts: <Badge variant="secondary">{result.data.credentials.password}</Badge>
                      </p>
                      <ScrollArea className="h-48 rounded border">
                        <div className="p-3 space-y-2">
                          {result.data.credentials.users.map((user, idx) => (
                            <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
                              <div>
                                <p className="text-sm font-medium">{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </div>
                              <Badge variant="outline" className="capitalize">{user.role}</Badge>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-red-500">{result.error}</p>
                )}
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Reset All Data</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This will permanently delete <strong>all operational data</strong> including members, 
                memberships, invoices, payments, attendance, classes, and more.
              </p>
              <p>
                Your user accounts, roles, and branches will be preserved.
              </p>
              <div className="pt-2">
                <Label htmlFor="reset-confirm" className="text-sm font-medium">
                  Type <span className="font-mono font-bold text-destructive">RESET</span> to confirm:
                </Label>
                <Input
                  id="reset-confirm"
                  value={resetConfirmText}
                  onChange={(e) => setResetConfirmText(e.target.value)}
                  placeholder="Type RESET here"
                  className="mt-2"
                  autoComplete="off"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setResetConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAllData}
              disabled={resetConfirmText !== 'RESET'}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reset All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
