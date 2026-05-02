# Bundle Strategy

## Vendor chunk split (vite.config.ts)

| Chunk            | Contains                                                        | Loaded by                              |
|------------------|-----------------------------------------------------------------|----------------------------------------|
| `react-vendor`   | react, react-dom, react-router-dom, react-helmet-async          | every route                            |
| `data-vendor`    | @tanstack/react-query, @supabase/supabase-js                    | every authenticated route              |
| `radix-vendor`   | all @radix-ui/* primitives                                      | every route using shadcn               |
| `ui-vendor`      | lucide-react, sonner, cmdk, vaul, cva, tailwind-merge, clsx     | every route                            |
| `forms-vendor`   | react-hook-form, @hookform/*, zod                               | routes with forms                      |
| `date-vendor`    | date-fns, react-day-picker                                      | routes with calendars / date pickers   |
| `charts-vendor`  | recharts, d3-*                                                  | dashboards, analytics, finance         |
| `motion-vendor`  | framer-motion, embla-carousel, @hello-pangea/dnd                | landing page, kanban, carousels        |
| `docs-vendor`    | jspdf, jspdf-autotable, qrcode, html2canvas, xlsx               | invoice / receipt / report generation  |
| `three`          | three, @react-three/fiber, @react-three/drei                    | `/` (InclineAscent only)               |

## Rules

1. **No static page imports** outside `src/App.tsx`. Pages must be `lazy(() => import(...))`.
2. **Heavy libs (`jspdf`, `xlsx`, `qrcode`, `html2canvas`, `three`) must never be top-level imported by shared utilities** consumed across many routes. If they must be, ensure the importing util is itself only used inside lazy-loaded pages.
3. **`lucide-react` imports must be named** (`import { X } from 'lucide-react'`) — never namespace imports — so tree-shaking works.
4. **`framer-motion` is a candidate for removal** if no module imports it; check before each release.

## CI guard

`.github/workflows/ci.yml` runs `vite build` and fails if:
- the entry chunk exceeds **250 KB gzip**, or
- any single chunk exceeds **600 KB gzip**.

The guard prints the top-10 chunks by gzip size for visibility.

## Observed targets (post-split)

- Entry: ~180–220 KB gzip (was ~866 KB)
- `three`: only loaded on `/`
- `docs-vendor`: only loaded on invoice/POS/HRM routes
- `charts-vendor`: only loaded on dashboard/analytics/finance routes
