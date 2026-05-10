import { useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileUp, Loader2, FileText, Dumbbell, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPlanTemplate, uploadTemplatePdf } from '@/services/fitnessService';
import { useBranchContext } from '@/contexts/BranchContext';

interface UploadPdfTemplateDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: 'workout' | 'diet';
}

export function UploadPdfTemplateDrawer({
  open,
  onOpenChange,
  defaultType = 'workout',
}: UploadPdfTemplateDrawerProps) {
  const { effectiveBranchId } = useBranchContext();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [type, setType] = useState<'workout' | 'diet'>(defaultType);
  const [goal, setGoal] = useState('');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const reset = () => {
    setName('');
    setGoal('');
    setDifficulty('intermediate');
    setDescription('');
    setFile(null);
    setType(defaultType);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Please choose a PDF file.');
      if (!name.trim()) throw new Error('Template name is required.');
      const uploaded = await uploadTemplatePdf(file, effectiveBranchId ?? null);
      return createPlanTemplate({
        branch_id: effectiveBranchId ?? null,
        name: name.trim(),
        type,
        description: description.trim() || undefined,
        difficulty,
        goal: goal.trim() || undefined,
        source_kind: 'pdf',
        pdf_url: uploaded.url,
        pdf_filename: uploaded.filename,
        pdf_size_bytes: uploaded.size,
      });
    },
    onSuccess: () => {
      toast.success('PDF template uploaded');
      queryClient.invalidateQueries({ queryKey: ['fitness-templates'] });
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message || 'Upload failed'),
  });

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col gap-0">
        <SheetHeader className="px-5 py-4 border-b text-left">
          <SheetTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-primary" />
            Upload PDF Template
          </SheetTitle>
          <SheetDescription>
            Use a ready-made PDF (diet chart, workout sheet) as a reusable template you can assign to members.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div className="space-y-2">
            <Label>Template name *</Label>
            <Input
              placeholder="e.g. Beginner Fat-Loss Diet — 1500 kcal"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'workout' | 'diet')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workout">
                    <span className="flex items-center gap-2">
                      <Dumbbell className="h-3.5 w-3.5" /> Workout
                    </span>
                  </SelectItem>
                  <SelectItem value="diet">
                    <span className="flex items-center gap-2">
                      <Utensils className="h-3.5 w-3.5" /> Diet
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Difficulty</Label>
              <Select
                value={difficulty}
                onValueChange={(v) => setDifficulty(v as typeof difficulty)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Goal (optional)</Label>
            <Input
              placeholder="e.g. Fat loss, Muscle gain, Maintenance"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Textarea
              placeholder="Short note about who this plan suits"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>PDF file *</Label>
            <div className="rounded-xl border-2 border-dashed bg-muted/30 p-4 text-center">
              {file ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-primary" />
                  <span className="font-medium truncate max-w-[14rem]">{file.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => setFile(null)}>
                    Change
                  </Button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 cursor-pointer text-sm text-muted-foreground">
                  <FileUp className="h-6 w-6" />
                  <span>Click to choose a PDF (max 16 MB)</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setFile(f);
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="px-5 py-4 border-t bg-muted/30 flex-row gap-2 sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !file || !name.trim()}
            className="gap-2"
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileUp className="h-4 w-4" />
            )}
            Upload Template
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
