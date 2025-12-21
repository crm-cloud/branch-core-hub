import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, Search } from 'lucide-react';

interface AddFeedbackDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

export function AddFeedbackDrawer({ open, onOpenChange, branchId }: AddFeedbackDrawerProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    member_id: '',
    member_name: '',
    employee_id: '',
    trainer_id: '',
    rating: 5,
    feedback_text: '',
    category: 'general',
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['branch-employees', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, profiles:user_id(full_name)')
        .eq('branch_id', branchId)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId && open,
  });

  const { data: trainers = [] } = useQuery({
    queryKey: ['branch-trainers', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const { data, error } = await supabase
        .from('trainers')
        .select('id, profiles:user_id(full_name)')
        .eq('branch_id', branchId)
        .eq('is_active', true);
      if (error) throw error;
      return data;
    },
    enabled: !!branchId && open,
  });

  const handleMemberSearch = async () => {
    if (!memberSearch.trim() || !branchId) return;
    const { data } = await supabase
      .from('members')
      .select(`
        id,
        member_code,
        profiles:user_id (full_name)
      `)
      .eq('branch_id', branchId)
      .or(`member_code.ilike.%${memberSearch}%`)
      .limit(10);
    setSearchResults(data || []);
  };

  const selectMember = (member: any) => {
    setFormData({
      ...formData,
      member_id: member.id,
      member_name: member.profiles?.full_name || member.member_code,
    });
    setSearchResults([]);
    setMemberSearch('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.member_id || !branchId) {
      toast.error('Please select a member');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('feedback').insert({
        branch_id: branchId,
        member_id: formData.member_id,
        employee_id: formData.employee_id || null,
        trainer_id: formData.trainer_id || null,
        rating: formData.rating,
        feedback_text: formData.feedback_text,
        category: formData.category,
        status: 'pending',
      });

      if (error) throw error;

      toast.success('Feedback recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      onOpenChange(false);
      setFormData({
        member_id: '',
        member_name: '',
        employee_id: '',
        trainer_id: '',
        rating: 5,
        feedback_text: '',
        category: 'general',
      });
    } catch (error: any) {
      console.error('Error adding feedback:', error);
      toast.error(error.message || 'Failed to record feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Record Member Feedback</SheetTitle>
          <SheetDescription>Capture feedback from gym members</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          {/* Member Search */}
          <div className="space-y-2">
            <Label>Search Member *</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter member code"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleMemberSearch())}
                  className="pl-10"
                />
              </div>
              <Button type="button" variant="outline" onClick={handleMemberSearch}>Search</Button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1 border rounded-md p-2">
                {searchResults.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => selectMember(member)}
                    className="p-2 rounded cursor-pointer hover:bg-muted/50"
                  >
                    <p className="font-medium">{member.profiles?.full_name || 'Unknown'}</p>
                    <p className="text-sm text-muted-foreground">{member.member_code}</p>
                  </div>
                ))}
              </div>
            )}

            {formData.member_id && (
              <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                <p className="font-medium text-sm">Selected: {formData.member_name}</p>
              </div>
            )}
          </div>

          {/* Rating */}
          <div className="space-y-2">
            <Label>Rating *</Label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFormData({ ...formData, rating: star })}
                  className="p-1"
                >
                  <Star
                    className={`h-8 w-8 ${
                      star <= formData.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Category</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData({ ...formData, category: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="service">Service</SelectItem>
                <SelectItem value="trainer">Trainer</SelectItem>
                <SelectItem value="facility">Facility</SelectItem>
                <SelectItem value="cleanliness">Cleanliness</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Employee */}
          <div className="space-y-2">
            <Label>Related Employee (Optional)</Label>
            <Select
              value={formData.employee_id || "none"}
              onValueChange={(v) => setFormData({ ...formData, employee_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not applicable</SelectItem>
                {employees.map((emp: any) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.profiles?.full_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trainer */}
          <div className="space-y-2">
            <Label>Related Trainer (Optional)</Label>
            <Select
              value={formData.trainer_id || "none"}
              onValueChange={(v) => setFormData({ ...formData, trainer_id: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select trainer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not applicable</SelectItem>
                {trainers.map((trainer: any) => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.profiles?.full_name || 'Unknown'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Feedback Text */}
          <div className="space-y-2">
            <Label>Feedback Details</Label>
            <Textarea
              placeholder="Enter member's feedback..."
              value={formData.feedback_text}
              onChange={(e) => setFormData({ ...formData, feedback_text: e.target.value })}
              rows={4}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !formData.member_id}>
              {isSubmitting ? 'Saving...' : 'Save Feedback'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
