import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2 } from 'lucide-react';

interface Branch {
  id: string;
  name: string;
}

interface BranchSelectorProps {
  branches: Branch[];
  selectedBranch: string;
  onBranchChange: (branchId: string) => void;
  showAllOption?: boolean;
}

export function BranchSelector({ branches, selectedBranch, onBranchChange, showAllOption = true }: BranchSelectorProps) {
  if (!branches || branches.length === 0) return null;

  return (
    <Select value={selectedBranch} onValueChange={onBranchChange}>
      <SelectTrigger className="w-[200px]">
        <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Select branch" />
      </SelectTrigger>
      <SelectContent>
        {showAllOption && (
          <SelectItem value="all">All Branches</SelectItem>
        )}
        {branches.map((branch) => (
          <SelectItem key={branch.id} value={branch.id}>
            {branch.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
