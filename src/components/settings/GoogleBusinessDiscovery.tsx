import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AccountItem { account_id: string; name: string; type?: string; role?: string }
interface LocationItem { location_id: string; title?: string; address?: string; store_code?: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  branchId: string;
  branchName?: string;
  initialAccountId?: string;
  initialLocationId?: string;
  onSaved?: () => void;
}

export default function GoogleBusinessDiscovery({
  open, onOpenChange, branchId, branchName, initialAccountId, initialLocationId, onSaved,
}: Props) {
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [saving, setSaving] = useState(false);
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [accountId, setAccountId] = useState(initialAccountId ?? '');
  const [locationId, setLocationId] = useState(initialLocationId ?? '');
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    setError(null);
    setLoadingAccounts(true);
    try {
      const { data, error } = await supabase.functions.invoke('google-reviews-brain', {
        body: { action: 'list_accounts', branch_id: branchId },
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) {
        setError(r?.reason ?? 'Could not fetch accounts');
        setAccounts([]);
        return;
      }
      setAccounts(r.items ?? []);
      if ((r.items ?? []).length === 0) setError('No Business Profile accounts found for this Google login.');
    } catch (e: any) {
      setError(e?.message ?? 'Discovery failed');
    } finally {
      setLoadingAccounts(false);
    }
  };

  const fetchLocations = async (acc: string) => {
    setError(null);
    setLoadingLocations(true);
    setLocations([]);
    setLocationId('');
    try {
      const { data, error } = await supabase.functions.invoke('google-reviews-brain', {
        body: { action: 'list_locations', branch_id: branchId, account_id: acc },
      });
      if (error) throw error;
      const r = data as any;
      if (!r?.ok) {
        setError(r?.reason ?? 'Could not fetch locations');
        return;
      }
      setLocations(r.items ?? []);
      if ((r.items ?? []).length === 0) setError('No locations found under this account.');
    } catch (e: any) {
      setError(e?.message ?? 'Discovery failed');
    } finally {
      setLoadingLocations(false);
    }
  };

  const handleAccountChange = (v: string) => {
    setAccountId(v);
    fetchLocations(v);
  };

  const handleSave = async () => {
    if (!accountId || !locationId) {
      toast.error('Pick both an account and a location');
      return;
    }
    setSaving(true);
    try {
      const { data: row, error: selErr } = await (supabase as any)
        .from('integration_settings')
        .select('id, config')
        .eq('integration_type', 'google_business')
        .eq('branch_id', branchId)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!row) {
        toast.error('Save base config first, then re-run Discover.');
        return;
      }
      const newConfig = { ...((row.config as any) ?? {}), account_id: accountId, location_id: locationId };
      const { error: updErr } = await (supabase as any)
        .from('integration_settings')
        .update({ config: newConfig })
        .eq('id', row.id);
      if (updErr) throw updErr;
      toast.success('Account & location saved');
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg flex flex-col">
        <SheetHeader>
          <SheetTitle>Discover Google Business IDs</SheetTitle>
          <SheetDescription>
            {branchName ? `Branch: ${branchName}. ` : ''}
            Auto-fetch your Account & Location from Google instead of pasting IDs by hand.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-5 py-4">
          <Button onClick={fetchAccounts} disabled={loadingAccounts} variant="outline" className="w-full">
            {loadingAccounts ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
            {accounts.length ? 'Refresh accounts' : 'Discover accounts'}
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {error.includes('OAuth not connected') && (
                  <span className="block mt-1 text-xs">Open Configure, save the OAuth Client ID/Secret, then click Connect Google before discovering IDs.</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {loadingAccounts && (
            <div className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
          )}

          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label>Business Account</Label>
              <Select value={accountId} onValueChange={handleAccountChange}>
                <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.account_id} value={a.account_id}>
                      {a.name} {a.role ? `· ${a.role}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground font-mono">{accountId}</p>
            </div>
          )}

          {loadingLocations && (
            <div className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-9 w-full" /></div>
          )}

          {locations.length > 0 && (
            <div className="space-y-2">
              <Label>Location</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.location_id} value={l.location_id}>
                      {l.title ?? l.location_id}{l.address ? ` — ${l.address}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground font-mono">{locationId}</p>
            </div>
          )}
        </div>

        <SheetFooter className="flex-row justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !accountId || !locationId}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save IDs
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
