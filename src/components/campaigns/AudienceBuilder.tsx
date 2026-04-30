import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users } from 'lucide-react';
import { resolveAudienceMemberIds, type AudienceFilter } from '@/services/campaignService';

interface Props {
  branchId: string;
  value: AudienceFilter;
  onChange: (filter: AudienceFilter) => void;
  onResolved: (memberIds: string[]) => void;
}

export function AudienceBuilder({ branchId, value, onChange, onResolved }: Props) {
  const [filter, setFilter] = useState<AudienceFilter>(value);

  useEffect(() => { onChange(filter); }, [filter, onChange]);

  const { data, isLoading } = useQuery({
    queryKey: ['campaign-audience', branchId, filter],
    queryFn: () => resolveAudienceMemberIds(branchId, filter),
    enabled: !!branchId,
    staleTime: 5_000,
  });

  useEffect(() => { if (data?.memberIds) onResolved(data.memberIds); }, [data, onResolved]);

  return (
    <div className="space-y-5">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Membership status</Label>
        <Select value={filter.status || 'all'} onValueChange={(v) => setFilter({ ...filter, status: v as any })}>
          <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            <SelectItem value="active">Active members</SelectItem>
            <SelectItem value="expired">Expired members</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Fitness goal contains</Label>
        <Input
          className="rounded-xl"
          placeholder="e.g. weight loss, muscle gain"
          value={filter.goal || ''}
          onChange={(e) => setFilter({ ...filter, goal: e.target.value || null })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Last visit before</Label>
          <Input
            type="date"
            className="rounded-xl"
            value={filter.last_attendance_before || ''}
            onChange={(e) => setFilter({ ...filter, last_attendance_before: e.target.value || null })}
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Last visit after</Label>
          <Input
            type="date"
            className="rounded-xl"
            value={filter.last_attendance_after || ''}
            onChange={(e) => setFilter({ ...filter, last_attendance_after: e.target.value || null })}
          />
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-500/10 dark:to-indigo-500/10 p-5 shadow-sm shadow-violet-200/40">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-violet-600 text-white flex items-center justify-center">
            <Users className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-xs uppercase text-muted-foreground tracking-wider">Live audience size</p>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Counting…
              </div>
            ) : (
              <p className="text-2xl font-bold text-foreground">{data?.memberIds.length ?? 0} <span className="text-sm font-normal text-muted-foreground">recipients</span></p>
            )}
          </div>
        </div>
        {!!data?.sample.length && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {data.sample.map((s) => <Badge key={s.id} variant="outline" className="text-[11px] rounded-full">{s.name}</Badge>)}
            {(data.memberIds.length > data.sample.length) && (
              <Badge variant="outline" className="text-[11px] rounded-full">+{data.memberIds.length - data.sample.length} more</Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
