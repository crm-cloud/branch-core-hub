import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Upload, X, Loader2, ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export function OrganizationSettings() {
  const queryClient = useQueryClient();
  const { effectiveBranchId, selectedBranch } = useBranchContext();
  const [dragActive, setDragActive] = useState(false);

  // Use effectiveBranchId for queries, or null for global settings when 'all' is selected
  const queryBranchId = selectedBranch === 'all' ? null : effectiveBranchId;

  const { data: orgSettings, isLoading } = useQuery({
    queryKey: ['organization-settings', queryBranchId],
    queryFn: async () => {
      let query = supabase.from('organization_settings').select('*');
      if (queryBranchId) {
        query = query.eq('branch_id', queryBranchId);
      } else {
        query = query.is('branch_id', null);
      }
      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [form, setForm] = useState({
    name: '',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
    fiscal_year_start: 'April',
  });

  // Sync form when data loads
  const [initialized, setInitialized] = useState(false);
  if (orgSettings && !initialized) {
    setForm({
      name: orgSettings.name || '',
      timezone: orgSettings.timezone || 'Asia/Kolkata',
      currency: orgSettings.currency || 'INR',
      fiscal_year_start: orgSettings.fiscal_year_start || 'April',
    });
    setInitialized(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      const payload = {
        ...values,
        branch_id: queryBranchId || null,
        logo_url: orgSettings?.logo_url || null,
      };
      // Use upsert to avoid 409 conflicts
      if (orgSettings?.id) {
        const { error } = await supabase
          .from('organization_settings')
          .update(payload)
          .eq('id', orgSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('organization_settings')
          .upsert(payload, { onConflict: 'branch_id' });
        if (error) {
          // Fallback to insert if upsert fails
          const { error: insertError } = await supabase
            .from('organization_settings')
            .insert(payload);
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: () => {
      toast.success('Settings saved');
      queryClient.invalidateQueries({ queryKey: ['organization-settings'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      const ext = file.name.split('.').pop();
      const path = `org-logo-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);

      const payload = {
        logo_url: publicUrl,
        branch_id: queryBranchId || null,
        name: form.name || null,
        timezone: form.timezone,
        currency: form.currency,
        fiscal_year_start: form.fiscal_year_start,
      };
      if (orgSettings?.id) {
        const { error } = await supabase.from('organization_settings').update({ logo_url: publicUrl }).eq('id', orgSettings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('organization_settings').insert(payload);
        if (error) throw error;
      }
      return publicUrl;
    },
    onSuccess: () => {
      toast.success('Logo uploaded');
      queryClient.invalidateQueries({ queryKey: ['organization-settings'] });
    },
    onError: (e: any) => toast.error(e.message || 'Upload failed'),
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      if (!orgSettings?.id) return;
      const { error } = await supabase.from('organization_settings').update({ logo_url: null }).eq('id', orgSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Logo removed');
      queryClient.invalidateQueries({ queryKey: ['organization-settings'] });
    },
  });

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File must be under 5MB');
      return;
    }
    uploadLogoMutation.mutate(file);
  }, [uploadLogoMutation]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Organization Settings</h2>
        <p className="text-sm text-muted-foreground">Manage your organization's basic information</p>
      </div>

      {/* Logo Upload Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Gym Logo
          </CardTitle>
          <CardDescription>Upload your gym's logo (max 5MB)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            {orgSettings?.logo_url ? (
              <div className="relative group">
                <img
                  src={orgSettings.logo_url}
                  alt="Gym Logo"
                  className="h-24 w-24 rounded-xl object-cover border bg-muted"
                />
                <button
                  onClick={() => removeLogoMutation.mutate()}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              className={`flex-1 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFile(file);
                };
                input.click();
              }}
            >
              {uploadLogoMutation.isPending ? (
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              ) : (
                <>
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop or <span className="text-primary font-medium">click to upload</span>
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Organization Details</CardTitle>
          </div>
          <CardDescription>Basic information about your gym</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input
                id="org-name"
                placeholder="Your Gym Name"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                placeholder="Asia/Kolkata"
                value={form.timezone}
                onChange={(e) => setForm(f => ({ ...f, timezone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                placeholder="INR"
                value={form.currency}
                onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiscal-year">Fiscal Year Start</Label>
              <Input
                id="fiscal-year"
                placeholder="April"
                value={form.fiscal_year_start}
                onChange={(e) => setForm(f => ({ ...f, fiscal_year_start: e.target.value }))}
              />
            </div>
          </div>
          <Button
            className="w-full md:w-auto"
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
