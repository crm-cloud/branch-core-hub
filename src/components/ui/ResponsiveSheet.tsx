import * as React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * Responsive Sheet wrapper:
 *  - Desktop (sm+): right-side drawer
 *  - Mobile: bottom sheet with rounded top corners
 *
 * Drop-in replacement for Dialog/DialogContent. Use the helpers below
 * (ResponsiveSheetHeader, Title, Description, Footer) for consistent styling.
 *
 * Width preset (desktop):
 *   - sm: sm:max-w-sm
 *   - md: sm:max-w-md (default)
 *   - lg: sm:max-w-lg
 *   - xl: sm:max-w-xl
 *   - 2xl: sm:max-w-2xl
 */
type Width = "sm" | "md" | "lg" | "xl" | "2xl";

const WIDTH_MAP: Record<Width, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  "2xl": "sm:max-w-2xl",
};

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  width?: Width;
  className?: string;
  children: React.ReactNode;
}

export function ResponsiveSheet({
  open,
  onOpenChange,
  width = "md",
  className,
  children,
}: ResponsiveSheetProps) {
  const widthClass = WIDTH_MAP[width];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn(
          // Mobile: full-width bottom sheet
          "w-full max-w-full p-0 flex flex-col",
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:h-[92dvh]",
          "max-sm:rounded-t-2xl max-sm:border-t max-sm:border-l-0",
          "max-sm:data-[state=closed]:slide-out-to-bottom max-sm:data-[state=open]:slide-in-from-bottom",
          // Desktop: right drawer
          `sm:p-6 sm:h-full sm:rounded-none sm:border-l sm:${widthClass}`,
          widthClass,
          className,
        )}
      >
        {/* Drag handle on mobile */}
        <div className="sm:hidden mx-auto mt-3 mb-1 h-1.5 w-12 rounded-full bg-muted shrink-0" />
        <div className="flex-1 overflow-y-auto px-4 sm:px-0 pb-4 sm:pb-0 flex flex-col">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export const ResponsiveSheetHeader = SheetHeader;
export const ResponsiveSheetTitle = SheetTitle;
export const ResponsiveSheetDescription = SheetDescription;
export function ResponsiveSheetFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mt-auto pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-2",
        "sticky bottom-0 bg-background pb-2 sm:pb-0",
        className,
      )}
      {...props}
    />
  );
}
