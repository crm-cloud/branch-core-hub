import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRecordBenefitUsage, useValidateBenefitUsage } from '@/hooks/useBenefits';
import { benefitTypeLabels, type MemberBenefitBalance } from '@/services/benefitService';
import type { Database } from '@/integrations/supabase/types';

type BenefitType = Database['public']['Enums']['benefit_type'];

const formSchema = z.object({
  benefit_type: z.string().min(1, 'Please select a benefit'),
  usage_count: z.coerce.number().min(1, 'Minimum 1').max(10, 'Maximum 10'),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface RecordBenefitUsageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membershipId: string;
  memberId: string;
  memberName: string;
  availableBenefits: MemberBenefitBalance[];
  preselectedBenefit?: BenefitType;
}

export function RecordBenefitUsageDrawer({
  open,
  onOpenChange,
  membershipId,
  memberName,
  availableBenefits,
  preselectedBenefit,
}: RecordBenefitUsageDrawerProps) {
  const [isValidating, setIsValidating] = useState(false);
  const recordMutation = useRecordBenefitUsage();
  const validateMutation = useValidateBenefitUsage();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      benefit_type: preselectedBenefit || '',
      usage_count: 1,
      notes: '',
    },
  });

  const selectedBenefitValue = form.watch('benefit_type');
  // Match by benefit_type_id if it looks like a UUID, otherwise by enum
  const selectedBalance = availableBenefits.find(b => 
    b.benefit_type_id === selectedBenefitValue || b.benefit_type === selectedBenefitValue
  );

  async function onSubmit(values: FormValues) {
    setIsValidating(true);

    try {
      // Validate first
      const validation = await validateMutation.mutateAsync({
        membershipId,
        benefitType: values.benefit_type as BenefitType,
      });

      if (!validation.valid) {
        toast.error(validation.message || 'Cannot record usage');
        setIsValidating(false);
        return;
      }

      // Record usage - resolve the actual enum and optional UUID
      const matchedBalance = availableBenefits.find(b => 
        b.benefit_type_id === values.benefit_type || b.benefit_type === values.benefit_type
      );
      await recordMutation.mutateAsync({
        membershipId,
        benefitType: (matchedBalance?.benefit_type || values.benefit_type) as BenefitType,
        usageCount: values.usage_count,
        notes: values.notes,
        benefitTypeId: matchedBalance?.benefit_type_id || undefined,
      });

      toast.success(`${matchedBalance?.label || values.benefit_type} usage recorded`);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to record usage');
    } finally {
      setIsValidating(false);
    }
  }

  // Filter to only show benefits that have remaining usage
  const recordableBenefits = availableBenefits.filter(
    b => b.isUnlimited || (b.remaining !== null && b.remaining > 0)
  );

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-md">
          <DrawerHeader>
            <DrawerTitle>Record Benefit Usage</DrawerTitle>
            <DrawerDescription>
              Record a benefit usage for {memberName}
            </DrawerDescription>
          </DrawerHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 space-y-4">
              <FormField
                control={form.control}
                name="benefit_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Benefit Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select benefit..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {recordableBenefits.map((benefit) => (
                          <SelectItem key={benefit.benefit_type_id || benefit.benefit_type} value={benefit.benefit_type_id || benefit.benefit_type}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{benefit.label}</span>
                              {!benefit.isUnlimited && (
                                <span className="text-xs text-muted-foreground">
                                  {benefit.remaining} left
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedBalance && !selectedBalance.isUnlimited && (
                <div className="text-sm bg-muted p-3 rounded-md">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Used this period:</span>
                    <span className="font-medium">{selectedBalance.used}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining:</span>
                    <span className="font-medium text-primary">{selectedBalance.remaining}</span>
                  </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="usage_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage Count</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min={1} 
                        max={selectedBalance?.remaining ?? 10} 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription>
                      Number of times this benefit is being used
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Add any notes about this usage..."
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DrawerFooter className="px-0">
                <Button 
                  type="submit" 
                  disabled={isValidating || recordMutation.isPending}
                >
                  {isValidating ? 'Validating...' : recordMutation.isPending ? 'Recording...' : 'Record Usage'}
                </Button>
                <DrawerClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DrawerClose>
              </DrawerFooter>
            </form>
          </Form>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
