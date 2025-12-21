import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { Ruler, Scale, Camera, X, Loader2, TrendingUp } from 'lucide-react';

interface RecordMeasurementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
}

export function RecordMeasurementDrawer({
  open,
  onOpenChange,
  memberId,
  memberName,
}: RecordMeasurementDrawerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    weight_kg: '',
    height_cm: '',
    body_fat_percentage: '',
    chest_cm: '',
    waist_cm: '',
    hips_cm: '',
    biceps_left_cm: '',
    biceps_right_cm: '',
    thighs_left_cm: '',
    thighs_right_cm: '',
    calves_cm: '',
    notes: '',
  });
  
  const [photos, setPhotos] = useState<{ url: string; uploading: boolean }[]>([]);
  const [uploading, setUploading] = useState(false);

  const calculateBMI = () => {
    const weight = parseFloat(formData.weight_kg);
    const height = parseFloat(formData.height_cm);
    if (weight && height) {
      return (weight / Math.pow(height / 100, 2)).toFixed(1);
    }
    return null;
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setUploading(true);
    const newPhotos: string[] = [];

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }

      try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${memberId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        const { error } = await supabase.storage
          .from('member-photos')
          .upload(fileName, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('member-photos')
          .getPublicUrl(fileName);

        newPhotos.push(publicUrl);
      } catch (error) {
        console.error('Upload error:', error);
        toast.error(`Failed to upload ${file.name}`);
      }
    }

    setPhotos(prev => [...prev, ...newPhotos.map(url => ({ url, uploading: false }))]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const saveMeasurement = useMutation({
    mutationFn: async () => {
      const measurementData: any = {
        member_id: memberId,
        recorded_by: user?.id,
        photos: photos.map(p => p.url),
      };

      // Only add non-empty numeric fields
      const numericFields = [
        'weight_kg', 'height_cm', 'body_fat_percentage',
        'chest_cm', 'waist_cm', 'hips_cm',
        'biceps_left_cm', 'biceps_right_cm',
        'thighs_left_cm', 'thighs_right_cm', 'calves_cm'
      ];

      numericFields.forEach(field => {
        const value = formData[field as keyof typeof formData];
        if (value && value.trim() !== '') {
          measurementData[field] = parseFloat(value);
        }
      });

      if (formData.notes.trim()) {
        measurementData.notes = formData.notes.trim();
      }

      const { error } = await supabase
        .from('member_measurements')
        .insert(measurementData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Measurement recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['member-measurements', memberId] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save measurement');
    },
  });

  const resetForm = () => {
    setFormData({
      weight_kg: '',
      height_cm: '',
      body_fat_percentage: '',
      chest_cm: '',
      waist_cm: '',
      hips_cm: '',
      biceps_left_cm: '',
      biceps_right_cm: '',
      thighs_left_cm: '',
      thighs_right_cm: '',
      calves_cm: '',
      notes: '',
    });
    setPhotos([]);
  };

  const bmi = calculateBMI();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Record Measurements
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Member Info */}
          <Card>
            <CardContent className="pt-4">
              <p className="font-medium">{memberName}</p>
              <p className="text-sm text-muted-foreground">Recording new body measurements</p>
            </CardContent>
          </Card>

          {/* Basic Measurements */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Basic Measurements
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Weight (kg)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="70.5"
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Height (cm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="175"
                  value={formData.height_cm}
                  onChange={(e) => setFormData({ ...formData, height_cm: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Body Fat %</Label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="18.5"
                  value={formData.body_fat_percentage}
                  onChange={(e) => setFormData({ ...formData, body_fat_percentage: e.target.value })}
                />
              </div>
            </div>

            {bmi && (
              <Card className="bg-muted/50">
                <CardContent className="py-2 text-center">
                  <span className="text-sm text-muted-foreground">BMI: </span>
                  <span className="font-bold text-primary">{bmi}</span>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Body Measurements */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              Body Measurements (cm)
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Chest</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.chest_cm}
                  onChange={(e) => setFormData({ ...formData, chest_cm: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Waist</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.waist_cm}
                  onChange={(e) => setFormData({ ...formData, waist_cm: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hips</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.hips_cm}
                  onChange={(e) => setFormData({ ...formData, hips_cm: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Biceps (L)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.biceps_left_cm}
                  onChange={(e) => setFormData({ ...formData, biceps_left_cm: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Biceps (R)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.biceps_right_cm}
                  onChange={(e) => setFormData({ ...formData, biceps_right_cm: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Calves</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.calves_cm}
                  onChange={(e) => setFormData({ ...formData, calves_cm: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Thighs (L)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.thighs_left_cm}
                  onChange={(e) => setFormData({ ...formData, thighs_left_cm: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Thighs (R)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.thighs_right_cm}
                  onChange={(e) => setFormData({ ...formData, thighs_right_cm: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Progress Photos */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Camera className="h-4 w-4" />
              Progress Photos
            </h3>
            
            <div className="grid grid-cols-4 gap-2">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square">
                  <img
                    src={photo.url}
                    alt={`Progress ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full"
                    onClick={() => removePhoto(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
              
              <Button
                type="button"
                variant="outline"
                className="aspect-square flex flex-col items-center justify-center gap-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <Camera className="h-6 w-6" />
                    <span className="text-xs">Add</span>
                  </>
                )}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Any observations or notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => saveMeasurement.mutate()}
              disabled={saveMeasurement.isPending}
            >
              {saveMeasurement.isPending ? 'Saving...' : 'Save Measurement'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
