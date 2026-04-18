import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, UtensilsCrossed, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { CreateFlowLayout } from '@/components/fitness/create/CreateFlowLayout';
import { MemberSearchPicker, PickedMember } from '@/components/fitness/create/MemberSearchPicker';
import { newDraftId, saveDraft } from '@/lib/planDraft';
import { cn } from '@/lib/utils';

interface MealItem {
  food: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

interface MealSlot {
  name: string;
  time: string;
  items: MealItem[];
}

const DEFAULT_SLOTS: MealSlot[] = [
  { name: 'Breakfast', time: '07:30', items: [] },
  { name: 'Mid-Morning Snack', time: '10:30', items: [] },
  { name: 'Lunch', time: '13:00', items: [] },
  { name: 'Evening Snack', time: '16:30', items: [] },
  { name: 'Dinner', time: '20:00', items: [] },
];

const EMPTY_ITEM: MealItem = { food: '', quantity: '', calories: 0, protein: 0, carbs: 0, fats: 0 };

export default function CreateManualDietPage() {
  const navigate = useNavigate();

  const [planName, setPlanName] = useState('');
  const [description, setDescription] = useState('');
  const [member, setMember] = useState<PickedMember | null>(null);
  const [dietaryType, setDietaryType] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [calTarget, setCalTarget] = useState(2000);
  const [proteinTarget, setProteinTarget] = useState(120);
  const [carbsTarget, setCarbsTarget] = useState(220);
  const [fatTarget, setFatTarget] = useState(60);
  const [slots, setSlots] = useState<MealSlot[]>(DEFAULT_SLOTS);

  const totals = useMemo(() => slots.reduce((acc, s) => {
    s.items.forEach(i => {
      acc.calories += Number(i.calories) || 0;
      acc.protein += Number(i.protein) || 0;
      acc.carbs += Number(i.carbs) || 0;
      acc.fats += Number(i.fats) || 0;
    });
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0 }), [slots]);

  const exceeds = (val: number, target: number) => target > 0 && val > target;

  const updateSlot = (idx: number, patch: Partial<MealSlot>) =>
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));

  const addItem = (idx: number) =>
    updateSlot(idx, { items: [...slots[idx].items, { ...EMPTY_ITEM }] });

  const updateItem = (sIdx: number, iIdx: number, field: keyof MealItem, value: any) =>
    updateSlot(sIdx, {
      items: slots[sIdx].items.map((it, i) => i === iIdx ? { ...it, [field]: value } : it),
    });

  const removeItem = (sIdx: number, iIdx: number) =>
    updateSlot(sIdx, { items: slots[sIdx].items.filter((_, i) => i !== iIdx) });

  const handlePreview = () => {
    if (!planName.trim()) { toast.error('Plan name is required'); return; }
    if (!dietaryType) { toast.error('Dietary type is required'); return; }
    if (!cuisine) { toast.error('Cuisine is required'); return; }
    const totalItems = slots.reduce((s, m) => s + m.items.filter(i => i.food).length, 0);
    if (totalItems === 0) { toast.error('Add at least one meal item'); return; }

    const id = newDraftId();
    saveDraft({
      id,
      source: 'manual-diet',
      type: 'diet',
      name: planName,
      description,
      caloriesTarget: calTarget,
      memberId: member?.id,
      memberName: member?.full_name,
      memberCode: member?.member_code,
      dietaryType,
      cuisine,
      content: {
        name: planName,
        type: 'diet',
        description,
        dailyCalories: calTarget,
        dietaryType,
        cuisine,
        macros: { protein: `${proteinTarget}g`, carbs: `${carbsTarget}g`, fat: `${fatTarget}g` },
        slots: slots.map(s => ({
          name: s.name,
          time: s.time,
          items: s.items.filter(i => i.food),
          totals: s.items.reduce((a, i) => ({
            calories: a.calories + (Number(i.calories) || 0),
            protein: a.protein + (Number(i.protein) || 0),
            carbs: a.carbs + (Number(i.carbs) || 0),
            fats: a.fats + (Number(i.fats) || 0),
          }), { calories: 0, protein: 0, carbs: 0, fats: 0 }),
        })),
        totals,
      },
      createdAt: new Date().toISOString(),
    });
    navigate(`/fitness/preview/${id}`);
  };

  return (
    <CreateFlowLayout
      title="Manual Diet Plan"
      subtitle="Build daily meals with live macro tracking"
      step="build"
      backTo="/fitness/create"
      actions={<Button onClick={handlePreview}>Continue to Preview</Button>}
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Plan basics */}
          <Card>
            <CardHeader><CardTitle className="text-base">Plan Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Plan Name *</Label>
                  <Input value={planName} onChange={(e) => setPlanName(e.target.value)} placeholder="e.g. Cutting diet — phase 1" />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short summary" />
                </div>
                <div className="space-y-1.5">
                  <Label>Dietary Type *</Label>
                  <Select value={dietaryType} onValueChange={setDietaryType}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vegetarian">Vegetarian</SelectItem>
                      <SelectItem value="vegan">Vegan</SelectItem>
                      <SelectItem value="non_vegetarian">Non-Vegetarian</SelectItem>
                      <SelectItem value="eggetarian">Eggetarian</SelectItem>
                      <SelectItem value="pescatarian">Pescatarian</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Cuisine *</Label>
                  <Select value={cuisine} onValueChange={setCuisine}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="indian">Indian</SelectItem>
                      <SelectItem value="continental">Continental</SelectItem>
                      <SelectItem value="mediterranean">Mediterranean</SelectItem>
                      <SelectItem value="asian">Asian</SelectItem>
                      <SelectItem value="mixed">Mixed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Macro targets */}
          <Card>
            <CardHeader><CardTitle className="text-base">Daily Targets</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Calories</Label>
                  <Input type="number" value={calTarget} onChange={(e) => setCalTarget(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Protein (g)</Label>
                  <Input type="number" value={proteinTarget} onChange={(e) => setProteinTarget(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Carbs (g)</Label>
                  <Input type="number" value={carbsTarget} onChange={(e) => setCarbsTarget(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Fats (g)</Label>
                  <Input type="number" value={fatTarget} onChange={(e) => setFatTarget(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Meal slots */}
          {slots.map((slot, sIdx) => (
            <Card key={sIdx}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UtensilsCrossed className="h-4 w-4 text-accent" />
                    <Input
                      className="h-8 w-44"
                      value={slot.name}
                      onChange={(e) => updateSlot(sIdx, { name: e.target.value })}
                    />
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <Input
                      type="time"
                      className="h-8 w-28"
                      value={slot.time}
                      onChange={(e) => updateSlot(sIdx, { time: e.target.value })}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {slot.items.map((item, iIdx) => (
                  <div key={iIdx} className="grid grid-cols-12 gap-2 items-end p-2 bg-muted/30 rounded-md">
                    <div className="col-span-12 sm:col-span-3">
                      <Label className="text-xs">Food</Label>
                      <Input value={item.food} onChange={(e) => updateItem(sIdx, iIdx, 'food', e.target.value)} placeholder="Oats" />
                    </div>
                    <div className="col-span-6 sm:col-span-2">
                      <Label className="text-xs">Qty</Label>
                      <Input value={item.quantity} onChange={(e) => updateItem(sIdx, iIdx, 'quantity', e.target.value)} placeholder="100g" />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Label className="text-xs">Cal</Label>
                      <Input type="number" value={item.calories} onChange={(e) => updateItem(sIdx, iIdx, 'calories', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Label className="text-xs">P</Label>
                      <Input type="number" value={item.protein} onChange={(e) => updateItem(sIdx, iIdx, 'protein', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Label className="text-xs">C</Label>
                      <Input type="number" value={item.carbs} onChange={(e) => updateItem(sIdx, iIdx, 'carbs', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-3 sm:col-span-1">
                      <Label className="text-xs">F</Label>
                      <Input type="number" value={item.fats} onChange={(e) => updateItem(sIdx, iIdx, 'fats', parseFloat(e.target.value) || 0)} />
                    </div>
                    <div className="col-span-12 sm:col-span-3 flex justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(sIdx, iIdx)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => addItem(sIdx)}>
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Side: live macros + member */}
        <div className="space-y-4 lg:sticky lg:top-4 self-start">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Live Macros</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: 'Calories', val: totals.calories, target: calTarget, unit: '' },
                { label: 'Protein', val: totals.protein, target: proteinTarget, unit: 'g' },
                { label: 'Carbs', val: totals.carbs, target: carbsTarget, unit: 'g' },
                { label: 'Fats', val: totals.fats, target: fatTarget, unit: 'g' },
              ].map(row => (
                <div key={row.label} className={cn(
                  'flex items-center justify-between rounded-md border p-2',
                  exceeds(row.val, row.target) && 'border-destructive/50 bg-destructive/5'
                )}>
                  <div>
                    <p className="text-xs text-muted-foreground">{row.label}</p>
                    <p className={cn('text-lg font-bold', exceeds(row.val, row.target) && 'text-destructive')}>
                      {Math.round(row.val)}{row.unit}
                    </p>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    target<br />
                    <span className="font-medium text-foreground">{row.target}{row.unit}</span>
                  </div>
                </div>
              ))}
              {(exceeds(totals.calories, calTarget) || exceeds(totals.protein, proteinTarget) || exceeds(totals.carbs, carbsTarget) || exceeds(totals.fats, fatTarget)) && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 text-destructive text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  Daily totals exceed one or more targets.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Optional: Pre-Assign Member</CardTitle>
            </CardHeader>
            <CardContent>
              <MemberSearchPicker value={member} onChange={setMember} label="Member" />
              <p className="text-xs text-muted-foreground mt-2">You can also assign on the next step.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </CreateFlowLayout>
  );
}
