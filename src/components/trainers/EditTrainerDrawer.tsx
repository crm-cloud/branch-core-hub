import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { useUpdateTrainer } from '@/hooks/useTrainers';

interface EditTrainerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trainer: any;
}

const SPECIALIZATION_OPTIONS = [
  'Weight Training', 'Cardio', 'HIIT', 'Yoga', 'Pilates', 
  'CrossFit', 'Boxing', 'Zumba', 'Strength Training', 'Functional Training',
  'Calisthenics', 'Martial Arts', 'Swimming', 'Sports Conditioning'
];

const SALARY_TYPES = [
  { value: 'fixed', label: 'Fixed Monthly' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'commission', label: 'Commission Only' },
  { value: 'hybrid', label: 'Fixed + Commission' },
];

export function EditTrainerDrawer({ open, onOpenChange, trainer }: EditTrainerDrawerProps) {
  const updateTrainer = useUpdateTrainer();
  
  const [formData, setFormData] = useState({
    bio: '',
    hourly_rate: 0,
    max_clients: 10,
    fixed_salary: 0,
    salary_type: 'fixed',
    pt_share_percentage: 50,
    specializations: [] as string[],
    certifications: [] as string[],
    government_id: '',
    is_active: true,
  });
  
  const [newCertification, setNewCertification] = useState('');

  useEffect(() => {
    if (trainer) {
      setFormData({
        bio: trainer.bio || '',
        hourly_rate: trainer.hourly_rate || 0,
        max_clients: trainer.max_clients || 10,
        fixed_salary: trainer.fixed_salary || 0,
        salary_type: trainer.salary_type || 'fixed',
        pt_share_percentage: trainer.pt_share_percentage || 50,
        specializations: trainer.specializations || [],
        certifications: trainer.certifications || [],
        government_id: trainer.government_id || '',
        is_active: trainer.is_active ?? true,
      });
    }
  }, [trainer]);

  const handleSpecializationToggle = (spec: string) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec],
    }));
  };

  const addCertification = () => {
    if (newCertification.trim() && !formData.certifications.includes(newCertification.trim())) {
      setFormData(prev => ({
        ...prev,
        certifications: [...prev.certifications, newCertification.trim()],
      }));
      setNewCertification('');
    }
  };

  const removeCertification = (cert: string) => {
    setFormData(prev => ({
      ...prev,
      certifications: prev.certifications.filter(c => c !== cert),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trainer?.id) return;

    try {
      await updateTrainer.mutateAsync({
        trainerId: trainer.id,
        updates: {
          bio: formData.bio || null,
          hourly_rate: formData.hourly_rate,
          max_clients: formData.max_clients,
          fixed_salary: formData.fixed_salary,
          salary_type: formData.salary_type,
          pt_share_percentage: formData.pt_share_percentage,
          specializations: formData.specializations,
          certifications: formData.certifications,
          government_id_number: formData.government_id || null,
          is_active: formData.is_active,
        },
      });
      toast.success('Trainer updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update trainer');
    }
  };

  if (!trainer) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Trainer</SheetTitle>
          <SheetDescription>
            Update {trainer.profile_name}'s profile and compensation
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Active Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div>
              <Label className="font-medium">Active Status</Label>
              <p className="text-xs text-muted-foreground">Deactivating hides trainer from assignments</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
            />
          </div>

          {/* Bio */}
          <div className="space-y-2">
            <Label>Bio</Label>
            <Textarea
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Professional background and experience..."
              rows={3}
            />
          </div>

          {/* Specializations */}
          <div className="space-y-2">
            <Label>Specializations</Label>
            <div className="flex flex-wrap gap-2">
              {SPECIALIZATION_OPTIONS.map((spec) => (
                <Badge
                  key={spec}
                  variant={formData.specializations.includes(spec) ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => handleSpecializationToggle(spec)}
                >
                  {spec}
                </Badge>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div className="space-y-2">
            <Label>Certifications</Label>
            <div className="flex gap-2">
              <Input
                value={newCertification}
                onChange={(e) => setNewCertification(e.target.value)}
                placeholder="Add certification..."
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCertification())}
              />
              <Button type="button" variant="outline" onClick={addCertification}>
                Add
              </Button>
            </div>
            {formData.certifications.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {formData.certifications.map((cert) => (
                  <Badge key={cert} variant="secondary" className="gap-1">
                    {cert}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeCertification(cert)} 
                    />
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Clients</Label>
              <Input
                type="number"
                value={formData.max_clients}
                onChange={(e) => setFormData({ ...formData, max_clients: parseInt(e.target.value) || 10 })}
              />
            </div>
            <div className="space-y-2">
              <Label>Hourly Rate (₹)</Label>
              <Input
                type="number"
                value={formData.hourly_rate}
                onChange={(e) => setFormData({ ...formData, hourly_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Compensation */}
          <div className="space-y-4 p-4 border rounded-lg">
            <h4 className="font-medium">Compensation</h4>
            
            <div className="space-y-2">
              <Label>Salary Type</Label>
              <Select
                value={formData.salary_type}
                onValueChange={(v) => setFormData({ ...formData, salary_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SALARY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fixed Salary (₹)</Label>
                <Input
                  type="number"
                  value={formData.fixed_salary}
                  onChange={(e) => setFormData({ ...formData, fixed_salary: parseFloat(e.target.value) || 0 })}
                  disabled={formData.salary_type === 'commission'}
                />
              </div>
              <div className="space-y-2">
                <Label>PT Share (%)</Label>
                <Input
                  type="number"
                  value={formData.pt_share_percentage}
                  onChange={(e) => setFormData({ ...formData, pt_share_percentage: parseFloat(e.target.value) || 50 })}
                />
              </div>
            </div>
          </div>

          {/* Government ID */}
          <div className="space-y-2">
            <Label>Government ID</Label>
            <Input
              value={formData.government_id}
              onChange={(e) => setFormData({ ...formData, government_id: e.target.value })}
              placeholder="Aadhar/PAN number"
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateTrainer.isPending}>
              {updateTrainer.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
