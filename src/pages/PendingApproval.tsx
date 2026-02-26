import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, LogOut, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function PendingApproval() {
  const { signOut, refreshProfile, user } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshProfile();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'var(--gradient-hero)' }}
    >
      <Card className="w-full max-w-md glass animate-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-warning/20 text-warning">
            <Clock className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold">Account Pending</CardTitle>
          <CardDescription>
            Your account has been created but is not yet fully configured. An administrator needs to assign your role and branch access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">What happens next?</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Your gym admin will assign you a role (Staff, Trainer, Manager, etc.)</li>
              <li>You'll be assigned to a branch location</li>
              <li>Once done, refresh this page to continue</li>
            </ul>
          </div>

          {user?.email && (
            <p className="text-center text-sm text-muted-foreground">
              Logged in as <strong>{user.email}</strong>
            </p>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={handleRefresh} disabled={refreshing} className="w-full">
              <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Checking...' : 'Check Again'}
            </Button>
            <Button variant="outline" onClick={signOut} className="w-full">
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
