import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, X } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, subMonths } from 'date-fns';
import { cn } from '@/lib/utils';
import { DateRange } from 'react-day-picker';

interface DateRangeFilterProps {
  value?: { from: Date; to: Date } | null;
  onChange: (range: { from: Date; to: Date } | null) => void;
  className?: string;
}

const presets = [
  { label: 'Today', getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Yesterday', getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: 'Last 7 Days', getValue: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: 'This Week', getValue: () => ({ from: startOfWeek(new Date(), { weekStartsOn: 1 }), to: endOfWeek(new Date(), { weekStartsOn: 1 }) }) },
  { label: 'This Month', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Last Month', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Last 30 Days', getValue: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: 'Last 90 Days', getValue: () => ({ from: startOfDay(subDays(new Date(), 89)), to: endOfDay(new Date()) }) },
];

export function DateRangeFilter({ value, onChange, className }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    value ? { from: value.from, to: value.to } : undefined
  );

  const handlePresetClick = (preset: typeof presets[0]) => {
    const range = preset.getValue();
    setDateRange(range);
    onChange(range);
    setOpen(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      onChange({ from: range.from, to: range.to });
    }
  };

  const handleClear = () => {
    setDateRange(undefined);
    onChange(null);
    setOpen(false);
  };

  const displayValue = value
    ? `${format(value.from, 'MMM d')} - ${format(value.to, 'MMM d, yyyy')}`
    : 'Select dates';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal min-w-[200px]',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue}
          {value && (
            <X
              className="ml-auto h-4 w-4 opacity-50 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="border-r p-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 py-1">Quick Select</p>
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-sm"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={2}
              initialFocus
            />
            <div className="flex justify-end gap-2 pt-2 border-t mt-2">
              <Button variant="ghost" size="sm" onClick={handleClear}>
                Clear
              </Button>
              <Button size="sm" onClick={() => setOpen(false)}>
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
