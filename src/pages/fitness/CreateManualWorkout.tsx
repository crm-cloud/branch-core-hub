import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import { CreateFlowLayout } from '@/components/fitness/create/CreateFlowLayout';
import { MemberSearchPicker, PickedMember } from '@/components/fitness/create/MemberSearchPicker';
import { newDraftId, saveDraft } from '@/lib/planDraft';
import { VideoAttachmentControl } from '@/components/fitness/VideoAttachmentControl';

interface Exercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  weight: string;
  form_tips: string;
  video_url?: string;
  video_file_path?: string;
}

interface Day {
  day: string;
  focus: string;
  exercises: Exercise[];
}

const DEFAULT_DAYS: Day[] = [
  { day: 'Monday', focus: 'Upper Body', exercises: [] },
  { day: 'Tuesday', focus: 'Lower Body', exercises: [] },
  { day: 'Wednesday', focus: 'Rest', exercises: [] },
  { day: 'Thursday', focus: 'Push', exercises: [] },
  { day: 'Friday', focus: 'Pull', exercises: [] },
  { day: 'Saturday', focus: 'Legs / Cardio', exercises: [] },
  { day: 'Sunday', focus: 'Rest', exercises: [] },
];

const EMPTY_EXERCISE: Exercise = { name: '', sets: 3, reps: '12', rest_seconds: 60, weight: '', form_tips: '' };

export default function CreateManualWorkoutPage() {
  const navigate = useNavigate();

  const [planName, setPlanName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [goal, setGoal] = useState('General Fitness');
  const [member, setMember] = useState<PickedMember | null>(null);
  const [days, setDays] = useState<Day[]>(DEFAULT_DAYS);
  const [activeIdx, setActiveIdx] = useState(0);

  const updateDay = (idx: number, patch: Partial<Day>) =>
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));

  const addExercise = () =>
    updateDay(activeIdx, { exercises: [...days[activeIdx].exercises, { ...EMPTY_EXERCISE }] });

  const updateExercise = (exIdx: number, field: keyof Exercise, value: any) => {
    const next = days[activeIdx].exercises.map((ex, i) => i === exIdx ? { ...ex, [field]: value } : ex);
    updateDay(activeIdx, { exercises: next });
  };

  const removeExercise = (exIdx: number) =>
    updateDay(activeIdx, { exercises: days[activeIdx].exercises.filter((_, i) => i !== exIdx) });

  const totalExercises = days.reduce((s, d) => s + d.exercises.length, 0);

  const handlePreview = () => {
    if (!planName.trim()) { toast.error('Plan name is required'); return; }
    if (totalExercises === 0) { toast.error('Add at least one exercise'); return; }

    const id = newDraftId();
    saveDraft({
      id,
      source: 'manual-workout',
      type: 'workout',
      name: planName,
      description,
      goal,
      difficulty,
      memberId: member?.id,
      memberName: member?.full_name,
      memberCode: member?.member_code,
      content: {
        name: planName,
        type: 'workout',
        difficulty,
        goal,
        description,
        weeks: [{
          week: 1,
          days: days
            .filter(d => d.exercises.length > 0)
            .map(d => ({
              day: d.day,
              focus: d.focus,
              exercises: d.exercises.map(ex => ({
                name: ex.name,
                sets: ex.sets,
                reps: ex.reps,
                rest: `${ex.rest_seconds}s`,
                weight: ex.weight || undefined,
                notes: ex.form_tips || undefined,
                video_url: ex.video_url || undefined,
                video_file_path: ex.video_file_path || undefined,
              })),
            })),
        }],
      },
      createdAt: new Date().toISOString(),
    });
    navigate(`/fitness/preview/${id}`);
  };

  return (
    <CreateFlowLayout
      title="Manual Workout Plan"
      subtitle="Build a day-by-day program"
      step="build"
      backTo="/fitness/create"
      actions={<Button onClick={handlePreview} disabled={!planName.trim() || totalExercises === 0}>Continue to Preview</Button>}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Plan Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Plan Name *</Label>
                  <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Push/Pull/Legs Hypertrophy" />
                </div>
                <div className="space-y-1.5">
                  <Label>Goal</Label>
                  <Select value={goal} onValueChange={setGoal}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Weight Loss">Weight Loss</SelectItem>
                      <SelectItem value="Muscle Gain">Muscle Gain</SelectItem>
                      <SelectItem value="General Fitness">General Fitness</SelectItem>
                      <SelectItem value="Endurance">Endurance</SelectItem>
                      <SelectItem value="Flexibility">Flexibility</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Difficulty</Label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Dumbbell className="h-4 w-4" /> Weekly Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {days.map((d, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    variant={activeIdx === idx ? 'default' : 'outline'}
                    onClick={() => setActiveIdx(idx)}
                    className="gap-1.5"
                  >
                    {d.day}
                    {d.exercises.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">{d.exercises.length}</Badge>
                    )}
                  </Button>
                ))}
              </div>

              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm w-20">{days[activeIdx].day}</span>
                  <Input
                    className="h-8 max-w-xs"
                    placeholder="Focus (e.g. Chest & Triceps)"
                    value={days[activeIdx].focus}
                    onChange={(e) => updateDay(activeIdx, { focus: e.target.value })}
                  />
                </div>

                {days[activeIdx].exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="rounded-md border bg-background p-3 space-y-2">
                    <div className="grid gap-2 grid-cols-12">
                      <div className="col-span-12 sm:col-span-4">
                        <Label className="text-xs">Exercise *</Label>
                        <Input value={ex.name} onChange={(e) => updateExercise(exIdx, 'name', e.target.value)} placeholder="Bench Press" />
                      </div>
                      <div className="col-span-3 sm:col-span-1">
                        <Label className="text-xs">Sets</Label>
                        <Input type="number" min={1} value={ex.sets} onChange={(e) => updateExercise(exIdx, 'sets', parseInt(e.target.value) || 1)} />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Label className="text-xs">Reps</Label>
                        <Input value={ex.reps} onChange={(e) => updateExercise(exIdx, 'reps', e.target.value)} placeholder="8-10" />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Label className="text-xs">Rest (s)</Label>
                        <Input type="number" min={0} value={ex.rest_seconds} onChange={(e) => updateExercise(exIdx, 'rest_seconds', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Label className="text-xs">Weight</Label>
                        <Input value={ex.weight} onChange={(e) => updateExercise(exIdx, 'weight', e.target.value)} placeholder="60kg" />
                      </div>
                      <div className="col-span-12 sm:col-span-1 flex sm:items-end">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive ml-auto" onClick={() => removeExercise(exIdx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Form Tips</Label>
                      <Textarea
                        rows={2}
                        value={ex.form_tips}
                        onChange={(e) => updateExercise(exIdx, 'form_tips', e.target.value)}
                        placeholder="Cues for proper form, breathing, tempo…"
                      />
                    </div>
                    <VideoAttachmentControl
                      folder="exercises"
                      label="Demo video (URL or upload)"
                      value={{ video_url: ex.video_url, video_file_path: ex.video_file_path }}
                      onChange={(next) => {
                        const updated = days[activeIdx].exercises.map((e, i) =>
                          i === exIdx ? { ...e, video_url: next.video_url, video_file_path: next.video_file_path } : e
                        );
                        updateDay(activeIdx, { exercises: updated });
                      }}
                    />
                  </div>
                ))}

                <Button variant="outline" size="sm" className="w-full border-dashed" onClick={addExercise}>
                  <Plus className="h-4 w-4 mr-1" /> Add Exercise
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Optional: Pre-Assign Member</CardTitle>
            </CardHeader>
            <CardContent>
              <MemberSearchPicker value={member} onChange={setMember} label="Member" />
              <p className="text-xs text-muted-foreground mt-2">
                You can also assign on the next step.
              </p>
            </CardContent>
          </Card>
          <Card className="bg-muted/30">
            <CardContent className="pt-4 space-y-1.5">
              <p className="text-xs text-muted-foreground">Total exercises</p>
              <p className="text-2xl font-bold">{totalExercises}</p>
              <p className="text-xs text-muted-foreground">
                across {days.filter(d => d.exercises.length > 0).length} active days
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </CreateFlowLayout>
  );
}
