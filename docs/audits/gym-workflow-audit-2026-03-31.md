# Gym Management App — Deep Workflow Audit

**Date:** 2026-03-31  
**Scope:** End-to-end workflow readiness audit across auth, RBAC, branch scoping, navigation, build quality, and Supabase integration.  
**Skills used:** `ui-ux-pro-max` (UX and workflow quality lens) + `supabase-postgres-best-practices` (database and security lens).

---

## 1) Executive Summary

The application has strong functional breadth (multi-role dashboards, branch-aware operations, MIPS integration, member/staff/trainer workflows), but there are several **high-impact reliability and security-hardening gaps** that should be addressed before large-scale production rollout.

### Overall score (workflow readiness)

- **Product coverage:** 9/10 (very broad module coverage)
- **Access control architecture:** 7/10 (good route gating, but duplicated role logic and branch fallback behavior introduce drift risk)
- **Operational reliability:** 6/10 (lint broken in current environment, no automated test script, heavy bundle)
- **Performance & UX consistency:** 6/10 (chunk size and route/menu drift impact discoverability and speed)
- **Security posture:** 7/10 (RLS usage exists, but frontend production fallback config and branch fallback semantics need hardening)

**Recommended release stance:** Proceed only after P0 + P1 items below are completed.

---

## 2) Workflow Coverage Audit (What is working well)

### 2.1 Role-based workflow architecture is comprehensive

- Route-level role protection is implemented via `ProtectedRoute`, with explicit `requiredRoles` across pages and role-based redirects.  
- `DashboardRedirect` provides role-priority routing for member, trainer, staff, and management tracks.  
- Menus are segmented by role (`member`, `trainer`, `staff`, `admin`, `manager`).

### 2.2 Branch-aware workflow foundation exists

- Branch context computes `effectiveBranchId` and supports owner/admin all-branch behavior vs. restricted-role scoping.  
- Manager branch assignment and staff/member home-branch fetch logic are implemented via Supabase queries.

### 2.3 Core business domains are represented end-to-end

- Member lifecycle, plans, invoices/payments, attendance, classes/PT, leads/follow-ups, HRM, equipment/lockers, store/POS, referrals, announcements, and device integrations are all present in routing and menu topology.

---

## 3) Critical Findings (Prioritized)

## P0 — Must fix immediately

### P0.1 Frontend defaults to production Supabase URL/key when env vars are missing

`src/integrations/supabase/client.ts` ships fallback values for URL and anonymous key. If environment variables are misconfigured in non-production, clients can silently hit production data plane.

**Risk:** accidental production data writes, debugging confusion, compliance and incident risk.  
**Fix:** remove hardcoded fallbacks; fail fast on missing env vars; validate env at startup.

### P0.2 Lint pipeline currently broken (cannot complete baseline static checks)

`npm run lint` fails with ENOENT on a timestamped Vite config artifact path, so quality gates are not dependable at the moment.

**Risk:** regressions can merge undetected; CI confidence is reduced.  
**Fix:** stabilize lint config/input resolution and make lint mandatory in CI before merge.

---

## P1 — High priority (next sprint)

### P1.1 Session inactivity timer issues repeated DB reads on user activity

`AuthContext` resets inactivity by re-querying `organization_settings` on each activity event (`mousedown`, `keydown`, `scroll`, `touchstart`). This creates repeated asynchronous reads and can race under heavy interaction.

**Risk:** unnecessary DB/network overhead, inconsistent timer updates, noisy auth behavior.  
**Fix:** fetch timeout once per session (or cache with TTL), then only reset local timer.

### P1.2 Branch context fallback can over-broaden scope in degraded states

In `BranchContext`, when restricted-role branch fetches are absent/unresolved, logic falls back to `allBranches`.

**Risk:** UI may display broader branch options than intended in edge/error states (even if backend RLS blocks writes, it still increases exposure and confusion).  
**Fix:** for restricted roles, default to empty state + explicit recovery, never `allBranches` fallback.

### P1.3 Duplicate role-priority logic in two places

Role-routing logic appears in both `ProtectedRoute` and `DashboardRedirect`, increasing drift probability.

**Risk:** inconsistent redirect behavior over time.  
**Fix:** extract a shared `resolveHomeRoute(roles)` utility and use it in both places.

### P1.4 Navigation coverage drift: routes not discoverable from menus

Automated comparison found 6 routes not represented in role menus (`/admin-roles`, `/book-benefit`, `/employees`, `/equipment`, `/my-plans`, `/my-pt-sessions`).

**Risk:** hidden workflows, support burden, QA blind spots.  
**Fix:** either add menu entries intentionally or document and enforce route deprecations/redirect-only status.

---

## P2 — Important optimization

### P2.1 Main bundle is too large

Production build reports a very large main JS bundle (~3.7MB pre-gzip, ~867KB gzip), plus dynamic/static import overlap warnings.

**Risk:** slower first-load time, worse mobile performance, lower Lighthouse/Core Web Vitals.  
**Fix:** stronger route-level splitting, modular import boundaries, manual chunk strategy, and de-duping dynamic/static mixed imports.

### P2.2 Missing explicit automated test suite entrypoint

Current `package.json` scripts include dev/build/lint/preview, but no test runner script.

**Risk:** weak regression safety for business-critical workflows.  
**Fix:** add unit/integration smoke tests for auth, role redirects, branch scoping, and financial transaction workflows.

---

## 4) End-to-End Workflow Health by Persona

| Persona | Workflow completeness | Key risk |
|---|---:|---|
| Member | High | Hidden routes (`/book-benefit`, `/my-plans`, `/my-pt-sessions`) and navigation drift can reduce discoverability |
| Trainer | High | Redirect logic duplication may diverge with future role changes |
| Staff | High | Branch scoping fallback behavior under query failures |
| Manager | High | Branch-assignment consistency and fallback safety |
| Admin/Owner | Very High | Large bundle slows operational dashboards; lint gap affects release quality |

---

## 5) Database & Security Lens (Supabase-focused)

- Positive: codebase and migrations indicate broad RLS/policy usage and frequent `SECURITY DEFINER ... SET search_path` patterns, which is generally aligned with Supabase best practices.  
- Improvement area: frontend client should not silently select production defaults, and UI branch scoping should fail closed for non-admin roles.

---

## 6) 14-Day Remediation Plan

### Week 1 (stability + guardrails)
1. Remove Supabase fallback URL/key and add startup env assertions.  
2. Fix lint ENOENT issue and enforce lint in CI.  
3. Extract shared role-home resolver utility used by both route guard and dashboard redirect.  
4. Change restricted-role branch fallback from `allBranches` to fail-closed UX state.

### Week 2 (performance + coverage)
5. Implement chunking strategy and eliminate dynamic/static mixed-import overlap for core heavy modules.  
6. Add test script and smoke tests for critical journeys (auth, branch scoping, invoice/payment, member attendance).  
7. Reconcile route/menu matrix and explicitly document intentionally hidden routes.

---

## 7) Commands Run During Audit

- `npm run lint` (failed due to ENOENT config artifact path).  
- `npm run build` (succeeded with large-chunk and dynamic/static import warnings).  
- Python route/menu consistency check comparing `src/App.tsx` route paths with `src/config/menu.ts` hrefs.

---

## 8) Final Verdict

The app is feature-rich and operationally promising, but to pass a strict production-readiness bar for a multi-branch gym platform, prioritize **configuration safety, fail-closed branch scoping, lint/test gate reliability, and bundle reduction**.

