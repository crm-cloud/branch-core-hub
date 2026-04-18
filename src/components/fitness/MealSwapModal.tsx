import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, ArrowLeftRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchMealCatalog, MealCatalogEntry, MealType } from '@/services/mealCatalogService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Target meal context — used to filter and to show the original macros for comparison. */
  context: {
    name: string;
    mealType?: MealType;
    dietaryType?: string | null;
    cuisine?: string | null;
    calories?: number;
  } | null;
  onSelect: (entry: MealCatalogEntry) => void;
}

/**
 * Lists alternative meals from `meal_catalog` filtered by the plan's
 * dietary_type and cuisine, with each option showing its macros and a Select
 * action that replaces the meal in place.
 */
export function MealSwapModal({ open, onOpenChange, context, onSelect }: Props) {
  const [search, setSearch] = useState('');

  const { data: meals = [], isLoading } = useQuery({
    queryKey: ['meal-catalog', context?.dietaryType, context?.cuisine, context?.mealType, search],
    queryFn: () =>
      fetchMealCatalog({
        dietaryType: context?.dietaryType ?? null,
        cuisine: context?.cuisine ?? null,
        mealType: context?.mealType ?? null,
        search: search || undefined,
      }),
    enabled: open,
  });

  // Sort by closeness to original calories (when known)
  const target = context?.calories ?? 0;
  const sorted = target > 0 ? [...meals].sort((a, b) => Math.abs(a.calories - target) - Math.abs(b.calories - target)) : meals;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-accent" />
            Swap meal — {context?.name || ''}
          </DialogTitle>
          <DialogDescription>
            Filtered by {context?.dietaryType || 'any diet'} · {context?.cuisine || 'any cuisine'}
            {context?.mealType ? ` · ${context.mealType}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search meal..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <ScrollArea className="flex-1 pr-3 -mr-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No matching meals in the catalog. Try adjusting your search or seed more options in the admin meal catalog.
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border hover:border-accent/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{m.name}</p>
                      <Badge variant="outline" className="text-[10px]">{m.dietary_type.replace('_', ' ')}</Badge>
                      <Badge variant="outline" className="text-[10px]">{m.cuisine.replace('_', ' ')}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{m.meal_type}</Badge>
                    </div>
                    {m.default_quantity && (
                      <p className="text-xs text-muted-foreground mt-0.5">{m.default_quantity}</p>
                    )}
                    <div className="flex gap-3 text-[11px] text-muted-foreground mt-1">
                      <span><b className="text-foreground">{m.calories}</b> kcal</span>
                      <span>P {m.protein}g</span>
                      <span>C {m.carbs}g</span>
                      <span>F {m.fats}g</span>
                      {m.fiber > 0 && <span>Fiber {m.fiber}g</span>}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelect(m);
                      onOpenChange(false);
                    }}
                  >
                    Select
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
