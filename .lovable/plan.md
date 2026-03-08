

# Plan: Duration-Based PT Progress Timeline & Commission Audit Confirmation

## Commission Audit Result

The amortization is **working correctly**. Jessica's 3-month package (₹45,000, 40% commission = ₹18,000) generated exactly 3 commission rows:
- ₹6,000 — release Mar 7, 2026
- ₹6,000 — release Apr 6, 2026  
- ₹6,000 — release May 6, 2026

All with status `pending`. The HRM payroll already filters by `release_date`, so only the current month's ₹6,000 will count. No fix needed.

## UI Enhancement: Duration Progress Timeline

Replace the plain "89d left" text in the Active Packages table with a visual elapsed/remaining progress bar.

### File: `src/pages/PTSessions.tsx`

**Lines 359-363** — Replace the text-only progress cell with a visual component:

```text
┌──────────────────────────────────────┐
│ ██████████░░░░░░░░░░  1d / 90d      │
│ Started Mar 7 · Ends Jun 5          │
└──────────────────────────────────────┘
```

- Calculate `totalDays = expiry_date - start_date`
- Calculate `elapsedDays = today - start_date`
- Calculate `percentage = (elapsedDays / totalDays) * 100`
- Render a `Progress` bar (from `@/components/ui/progress`) with the percentage
- Below the bar: `{elapsedDays}d / {totalDays}d` text
- For session-based packages: keep existing `remaining/total sessions` text with a similar bar (`(total - remaining) / total * 100`)

### File: `src/services/ptService.ts`

**Lines 131-141** — Add `start_date` to the select query (it's already returned via `*` wildcard, but ensure it's available in the mapped result). The `*` already includes `start_date` and `expiry_date`, so no service change needed.

### Changes Summary

| File | Change |
|------|--------|
| `src/pages/PTSessions.tsx` | Import `Progress` component; replace plain text progress with visual bar showing elapsed/total days for duration packages, and used/total sessions for session packages |

### Implementation Detail

For the progress cell (lines 359-363), replace with:

```tsx
<TableCell>
  {pkg.sessions_total > 0 ? (
    <div className="space-y-1 min-w-[120px]">
      <Progress value={((pkg.sessions_total - pkg.sessions_remaining) / pkg.sessions_total) * 100} className="h-2" />
      <span className="text-xs text-muted-foreground">
        {pkg.sessions_total - pkg.sessions_remaining}/{pkg.sessions_total} sessions
      </span>
    </div>
  ) : (
    <div className="space-y-1 min-w-[140px]">
      <Progress value={elapsed/total * 100} className="h-2" />
      <span className="text-xs text-muted-foreground">
        {elapsedDays}d / {totalDays}d elapsed
      </span>
    </div>
  )}
</TableCell>
```

Color the bar green when < 75%, amber when 75-90%, red when > 90% elapsed.

