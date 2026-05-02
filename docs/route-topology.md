# Route Topology

This file maps every authenticated route in `src/App.tsx` to its menu surfacing.
Used by humans + the CI route-discoverability check.

## Menu-surfaced routes

All routes listed in `src/config/menu.ts` (memberMenuConfig, trainerMenuConfig,
staffMenuConfig, adminMenuConfig, managerMenuConfig) are intentionally
discoverable.

## Intentionally hidden / contextual routes

These routes have **no sidebar entry** by design. They are reached via
contextual entry points (drawers, redirects, or direct linking from a related
page) and should not be added to the global menu.

| Route                  | Why hidden                                                              |
|------------------------|-------------------------------------------------------------------------|
| `/my-pt-sessions`      | Member-portal redirect → `/my-classes?tab=appointments`. Kept for legacy QR codes / push-notification deep-links. |
| `/fitness/create`      | Sub-route of "Diet & Workout" — already surfaced via that menu entry.   |
| `/member/pay`          | Embedded checkout, reached from invoice CTA. Never linked from sidebar. |
| `/dr-readiness`        | Disaster-recovery operational page, owner-only, surfaced under System Health. |

## Surfaced after this wave

| Route                  | Menu location                                  |
|------------------------|------------------------------------------------|
| `/book-benefit`        | Member → Fitness → "Book a Benefit"            |
| `/equipment`           | Owner/Admin/Manager → Operations → "Equipment" |
| `/admin-roles`         | Already present under Admin & HR               |
| `/employees`           | Already present under Admin & HR               |
| `/my-plans`            | Already present under My Account               |

## How to add a new route

1. Add the `<Route>` in `src/App.tsx` with `<ProtectedRoute requiredRoles={[...]}>`.
2. Add a corresponding `MenuItem` in the matching menu config in
   `src/config/menu.ts`, **or** add the route to the "Intentionally hidden"
   table above with a justification.
3. CI will fail if a route is neither surfaced nor documented as hidden.
