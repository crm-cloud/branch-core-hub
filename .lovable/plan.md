Make the floating words smaller and a bit faster:

1. Reduce sizes in `src/components/3d/FloatingWords.tsx`
   - Drop each word's `clamp()` font-size to roughly half:
     - Large words: `clamp(0.75rem, 1.8vw, 1.25rem)`
     - Medium: `clamp(0.7rem, 1.6vw, 1.1rem)`
     - Small: `clamp(0.65rem, 1.4vw, 1rem)`

2. Speed up the random floating animations
   - Cut each word's `dur` roughly in half (and tighten delays):
     - RISE 22s → 12s
     - REFLECT 26s → 14s
     - REPEAT 30s → 16s
     - RECOVER 24s → 13s
     - RESTORE 28s → 15s
     - REBUILD 32s → 17s

3. Keep everything else as-is (random directions, scoped blue color, opacity, layering). No CSS keyframe changes needed — the existing `incFloatA…F` keyframes remain, just driven faster.

Files to change:
- `src/components/3d/FloatingWords.tsx`