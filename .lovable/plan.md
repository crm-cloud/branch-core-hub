Plan to fix the current landing page issues:

1. Fix the R3F crash at the source
   - `FloatingWords` is currently rendered outside `<Canvas>` in `Scene3D`, but it still imports/uses R3F hooks (`useFrame`) and Drei `<Text>`.
   - I will convert `FloatingWords` into a pure DOM/CSS component: no `@react-three/fiber`, no `@react-three/drei`, no Three.js hooks.
   - This keeps it safe to render outside `<Canvas>` and will eliminate: `R3F: Hooks can only be used within the Canvas component!`

2. Restore randomized floating word motion
   - Replace the forced left-to-right drift with independent “random direction” animations.
   - Each word will have its own fixed start position, size, opacity, duration, delay, and motion path.
   - Movement will be subtle: small diagonal/orbital/random floating paths, not a marquee from left to right.
   - Keep words ambient: smaller, lower opacity, behind the hero content and dumbbell.

3. Audit and restore the old blue visual direction
   - The current `index.css` has the global primary token set to deep slate (`--primary: 222 47% 11%`) and accent orange, which is why the public landing no longer feels like the older blue design.
   - I will restore the public-facing landing page to the blue reference style:
     - Electric blue primary: approximately `#0D6EFD` / HSL `217 91% 50%`
     - Light premium background: `#F8FAFC` to pale slate/blue
     - Blue glow accents for the dumbbell and text highlights
   - To avoid breaking the admin SaaS theme, I will scope landing-page-specific color overrides to the public landing container instead of blindly changing every global token.

4. Align typography and reference CSS safely
   - Keep the old landing-style uppercase condensed look using Oswald for the public landing page.
   - Keep admin/app typography intact where possible.
   - Add/adjust safe utilities from the old CSS reference only where they help the public landing: smooth scroll, no horizontal overflow, hero/section title utilities, fade-in-up, and scroll indicator bounce.

5. Clean up noisy secondary error reporting issue
   - The console also shows repeated `log_error_event 404` calls after the crash.
   - I will add a small guard in the frontend error reporter so missing backend RPC responses do not spam retries/console noise during public-page crashes.
   - I will not make database changes unless needed; the main user-visible fix is the R3F crash and landing styling.

Files expected to change:
- `src/components/3d/FloatingWords.tsx`
- `src/components/3d/Scene3D.tsx` if needed for layering/z-index cleanup
- `src/index.css`
- `src/pages/InclineAscent.tsx` for scoped landing-page color variables/class
- `src/lib/errorReporter.ts` for the defensive 404/noise guard

Validation after implementation:
- Open the `/` landing page and confirm no R3F hook error appears.
- Confirm floating words move in varied/random directions, not left-to-right marquee.
- Confirm blue accents match the older reference direction.
- Confirm the 3D dumbbell still renders and scroll animation still works.
- Confirm the page has no horizontal overflow at desktop and mobile widths.