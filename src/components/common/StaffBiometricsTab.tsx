import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Fingerprint, CreditCard, MessageCircle, Shield, 
  Upload, CheckCircle, Clock, Loader2, RefreshCw, ChevronDown
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { queueStaffSync, queueTrainerSync, getSyncStatus } from '@/services/biometricService';

interface StaffBiometricsTabProps {
  staffId: string;
  staffType: 'employee' | 'trainer';
  staffName: string;
  branchId: string;
  biometricPhotoUrl?: string | null;
  biometricEnrolled?: boolean | null;
}

export function StaffBiometricsTab({
  staffId,
  staffType,
  staffName,
  branchId,
  biometricPhotoUrl,
  biometricEnrolled,
}: StaffBiometricsTabProps) {
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Fetch sync statuses
  const { data: syncStatuses = [], isLoading: syncLoading } = useQuery({
    queryKey: ['biometric-sync-status-staff', staffId],
    queryFn: () => getSyncStatus(staffId, staffType === 'trainer' ? 'trainer' : 'staff'),
    enabled: isOpen,
  });

  const enrollmentStatus = biometricEnrolled 
    ? 'enrolled' 
    : syncStatuses.some(s => s.status === 'pending' || s.status === 'syncing')
      ? 'pending'
      : 'not_enrolled';

  const getEnrollmentBadge = () => {
    switch (enrollmentStatus) {
      case 'enrolled':
        return <Badge className="bg-success/10 text-success border-success/20 border"><CheckCircle className="h-3 w-3 mr-1" />Enrolled</Badge>;
      case 'pending':
        return <Badge className="bg-warning/10 text-warning border-warning/20 border"><Clock className="h-3 w-3 mr-1" />Pending Sync</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">Not Enrolled</Badge>;
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `biometric-staff/${staffId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (staffType === 'trainer') {
        await queueTrainerSync(staffId, publicUrl, staffName);
      } else {
        await queueStaffSync(staffId, publicUrl, staffName);
      }
      
      toast.success('Biometric photo uploaded & sync queued');
      queryClient.invalidateQueries({ queryKey: ['biometric-sync-status-staff', staffId] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload photo');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border rounded-lg">
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full p-4 hover:bg-muted/30 transition-colors text-left">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-accent" />
              <span className="font-medium text-sm">Hardware & Biometrics</span>
              {getEnrollmentBadge()}
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4">
            {/* Face Enrollment */}
            <Card className="border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Fingerprint className="h-4 w-4" />
                  Face Enrollment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20 rounded-xl border-2 border-dashed border-muted-foreground/30">
                    <AvatarImage src={biometricPhotoUrl || undefined} className="object-cover" />
                    <AvatarFallback className="rounded-xl text-lg bg-muted">
                      <Fingerprint className="h-6 w-6 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Upload a front-facing photo for facial recognition.
                    </p>
                    <label htmlFor={`biometric-upload-${staffId}`}>
                      <Button variant="outline" size="sm" asChild disabled={isUploading}>
                        <span>
                          {isUploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
                          {biometricPhotoUrl ? 'Replace Photo' : 'Upload Photo'}
                        </span>
                      </Button>
                    </label>
                    <input
                      id={`biometric-upload-${staffId}`}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isUploading}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Device Sync Status */}
            <Card className="border">
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
                  <p className="text-sm text-muted-foreground text-center py-3">
                    No sync records. Upload a biometric photo to start.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
