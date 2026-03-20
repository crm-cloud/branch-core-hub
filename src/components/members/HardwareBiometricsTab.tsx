import { useState } from 'react';
import { TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { 
  Fingerprint, CreditCard, MessageCircle, Shield, 
  CheckCircle, Clock, AlertTriangle, Loader2, RefreshCw, Info
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getSyncStatus } from '@/services/biometricService';

interface HardwareBiometricsTabProps {
  memberId: string;
  memberName: string;
  memberStatus: string;
  biometricPhotoUrl?: string | null;
  biometricEnrolled?: boolean | null;
  wiegandCode?: string | null;
  customWelcomeMessage?: string | null;
  hardwareAccessEnabled?: boolean | null;
  branchId: string;
}

export function HardwareBiometricsTab({
  memberId,
  memberName,
  memberStatus,
  biometricEnrolled,
  wiegandCode: initialWiegandCode,
  customWelcomeMessage: initialMessage,
  hardwareAccessEnabled: initialAccessEnabled,
  branchId,
}: HardwareBiometricsTabProps) {
  const queryClient = useQueryClient();
  const [wiegandCode, setWiegandCode] = useState(initialWiegandCode || '');
  const [welcomeMessage, setWelcomeMessage] = useState(initialMessage || 'Welcome! Enjoy your workout');
  const [accessEnabled, setAccessEnabled] = useState(initialAccessEnabled ?? true);

  const isFrozenOrExpired = ['frozen', 'expired', 'cancelled'].includes(memberStatus);

  // Fetch sync statuses per device
  const { data: syncStatuses = [], isLoading: syncLoading } = useQuery({
    queryKey: ['biometric-sync-status', memberId],
    queryFn: () => getSyncStatus(memberId, 'member'),
  });

  // Save hardware fields mutation
  const saveMutation = useMutation({
    mutationFn: async (fields: Record<string, unknown>) => {
      const { error } = await supabase
        .from('members')
        .update(fields)
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Hardware settings saved');
      queryClient.invalidateQueries({ queryKey: ['member-details', memberId] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
    },
    onError: () => toast.error('Failed to save hardware settings'),
  });

  const handleSaveWiegand = () => saveMutation.mutate({ wiegand_code: wiegandCode || null });
  const handleSaveMessage = () => saveMutation.mutate({ custom_welcome_message: welcomeMessage });
  const handleToggleAccess = (checked: boolean) => {
    setAccessEnabled(checked);
    saveMutation.mutate({ hardware_access_enabled: checked });
  };

  const enrollmentStatus = biometricEnrolled 
    ? 'enrolled' 
    : syncStatuses.some(s => s.status === 'pending' || s.status === 'syncing')
      ? 'pending'
      : 'not_enrolled';

  const getEnrollmentBadge = () => {
    switch (enrollmentStatus) {
      case 'enrolled':
        return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30"><CheckCircle className="h-3 w-3 mr-1" />Enrolled</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30"><Clock className="h-3 w-3 mr-1" />Pending Sync</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Not Enrolled</Badge>;
    }
  };

  return (
    <TabsContent value="hardware" className="space-y-4 mt-4">
      {/* Face Enrollment Status — device-managed */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              Face Enrollment
            </CardTitle>
            {getEnrollmentBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Face enrollment is handled at the terminal</p>
              <p>
                To enroll this member's face, use the "Enroll" option directly on the access control 
                terminal at the gym entrance. The device will capture and store the biometric data automatically.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Wiegand Code */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Wiegand ID (Card/Chip)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              placeholder="e.g. 12345"
              value={wiegandCode}
              onChange={(e) => setWiegandCode(e.target.value)}
              className="font-mono"
            />
            <Button size="sm" onClick={handleSaveWiegand} disabled={saveMutation.isPending}>
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Numeric ID for card/chip based access</p>
        </CardContent>
      </Card>

      {/* Custom Welcome Message */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Custom Welcome Message
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Welcome, {name}! Enjoy your workout"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
            />
            <Button size="sm" onClick={handleSaveMessage} disabled={saveMutation.isPending}>
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Displayed on the device screen when member checks in. Use {'{name}'} for auto-substitution.
          </p>
        </CardContent>
      </Card>

      {/* Hardware Access Toggle */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Hardware Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                {accessEnabled ? 'Access Enabled' : 'Access Disabled'}
              </p>
              <p className="text-xs text-muted-foreground">
                Controls whether the turnstile opens for this member
              </p>
            </div>
            <Switch
              checked={accessEnabled}
              onCheckedChange={handleToggleAccess}
              disabled={isFrozenOrExpired || saveMutation.isPending}
            />
          </div>
          {isFrozenOrExpired && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 text-destructive text-xs">
              <AlertTriangle className="h-3 w-3 shrink-0" />
              Auto-disabled due to {memberStatus} membership status
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Status per Device */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Device Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : syncStatuses.length > 0 ? (
            <div className="space-y-2">
              {syncStatuses.map((sync) => (
                <div key={sync.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                  <span className="text-sm font-mono">{sync.device_id?.slice(0, 8)}...</span>
                  <Badge variant={
                    sync.status === 'completed' ? 'default' :
                    sync.status === 'failed' ? 'destructive' :
                    'secondary'
                  } className="text-xs capitalize">
                    {sync.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No sync records. Face enrollment is handled at the terminal device.
            </p>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}