# Prompt for Lovable — Gym Management App UI/UX + Workflow Upgrade

You are improving a production gym management app used by **members, trainers, staff, managers, and admins**.  
Your goal is to **redesign critical UX flows and strengthen workflow reliability** without breaking existing business logic.

## Context
The current app is feature-rich, but there are important UX/workflow issues to resolve:
1. Hidden/undiscoverable routes and inconsistent navigation depth across roles.
2. Role redirection logic is duplicated and may drift.
3. Branch-scoping UX can be confusing when scoped branch data is unavailable.
4. Large dashboard bundle impacts perceived speed.
5. Auth/session UX needs more predictable behavior and clearer status feedback.

## Your Mission
Deliver a polished, modern, fast UX that preserves role-based permissions while improving discoverability, consistency, and operational clarity.

---

## Product & Users
- **Product type:** B2B/B2C operational SaaS for gym branches.
- **Primary users:**
  - Member (self-service fitness + plans + billing)
  - Trainer (sessions, clients, schedule)
  - Staff (front-desk operations, attendance, payments)
  - Manager/Admin (analytics, HRM, approvals, settings)
- **Core user goals:** fast navigation, zero confusion on next action, branch clarity, trustworthy system status.

---

## Required Improvements (High Priority)

### 1) Navigation & Information Architecture
- Redesign side navigation so every role has:
  - A clear **Home**, **Daily Ops**, **People**, **Finance**, **Communication**, **Settings** grouping (role-adjusted)
  - No orphan/hidden essential pages
  - Predictable naming and icon consistency
- Propose where currently under-discoverable workflows should live:
  - `Admin Roles`
  - `Book Benefit`
  - `Employees`
  - `Equipment`
  - `My Plans`
  - `My PT Sessions`
- Include route-to-menu mapping table in output.

### 2) Role-Based Workflow Consistency
- Create a unified “role home destination” UX model:
  - Member → Member Dashboard
  - Trainer-only → Trainer Dashboard
  - Staff-only → Staff Dashboard
  - Manager/Admin/Owner → Main Dashboard
- Ensure unauthorized route attempts have graceful UX:
  - Contextual message (“You don’t have access to this section”)
  - One-click route to valid destination

### 3) Branch Scope UX (Fail-Closed, Not Confusing)
- For restricted roles (staff/trainer/member), never show ambiguous “all branches” behavior when branch fetch fails.
- Design explicit UX states:
  - Loading branch context
  - No branch assigned
  - Branch data unavailable (retry)
- Add branch badge/chip globally in app header: `Current branch: <name>`.

### 4) Auth & Session UX
- Improve login and post-login transitions with consistent loading states and clear outcomes.
- Add user-facing session timeout warnings:
  - “Your session will expire in X minutes” with extend-session action.
- Ensure password setup/reset journeys are visually consistent and easy to recover from errors.

### 5) Dashboard Performance UX
- Redesign dashboards with progressive loading:
  - Skeletons for cards/charts/lists
  - Lazy-render below-the-fold modules
  - No layout jumps
- Keep first-screen dashboard actionable within 1–2 seconds perceived load on mid-tier mobile/desktop.

---

## UX/Visual Standards You Must Follow
- WCAG AA contrast minimums.
- Touch targets >= 44px.
- Clear focus states for keyboard navigation.
- Semantic status colors with icon + text (not color-only).
- Consistent spacing scale (4/8pt rhythm).
- Responsive behavior for 375px mobile, tablet, desktop.
- Dark mode parity (not broken or lower contrast).

---

## Deliverables
Provide all of the following:

1. **UX Strategy Summary**
   - Top problems solved
   - Why your information architecture is better

2. **Role-by-Role Navigation Blueprint**
   - Member / Trainer / Staff / Manager / Admin menus
   - Route mapping and grouping rationale

3. **Critical Flow Redesigns**
   - Auth flow
   - Dashboard landing flow
   - Unauthorized access fallback flow
   - Branch-scoping failure flow

4. **Wireframe-level Layout Specs** (textual is fine)
   - Key screens with section hierarchy
   - Component placement and behavior

5. **Implementation Plan (phased)**
   - Phase 1 (quick wins, low risk)
   - Phase 2 (structural changes)
   - Phase 3 (performance and polish)

6. **Acceptance Checklist**
   - Measurable criteria for UX, workflow, and performance outcomes

---

## Technical Constraints
- Keep current role permissions and backend security model intact.
- Avoid breaking existing route URLs unless explicitly providing redirects.
- Prefer incremental refactor over full rewrite.
- Keep design system token-based and reusable.
- Use component-level patterns compatible with React + TypeScript + Tailwind + shadcn UI.

---

## Output Style
- Be concrete and implementation-oriented.
- Provide structured tables and bullet points.
- Prioritize actionable changes over generic design advice.
- If trade-offs exist, state the recommendation and why.



---

## Additional Mandatory Workflow Scope
Ensure your redesign explicitly audits and improves these end-to-end flows:
- Member onboarding/profile lifecycle
- Membership purchase/renew/freeze/cancel
- Invoice + payment collection (full and partial)
- Facial registration/biometric sync (including pending/failed recovery UX)
- Reminder delivery (membership/payment follow-ups)
- WhatsApp conversations, templates, and delivery-state clarity

For each flow, output:
1. Current risk points
2. Proposed UX and workflow improvements
3. Failure/retry states
4. Data-integrity safeguards
5. Acceptance criteria

---

## Production Error-Free Mode (Strict)
When executing this prompt, assume target is a production-hardening release. In your output, include:

1. **Atomicity Plan**
   - Identify any multi-step workflows that can fail mid-way.
   - Propose backend-atomic transaction boundaries for each.

2. **Branch/Tenant Safety Plan**
   - Confirm every workflow step is branch-scoped.
   - Define fail-closed behavior if branch scope cannot be resolved.

3. **Failure-State UX Matrix**
   - For each critical flow, provide user-visible states for:
     - transient failure
     - retryable failure
     - terminal failure
     - partial success requiring operator action

4. **Production Acceptance Gates**
   - Lint/build/test pass criteria
   - Workflow smoke-test checklist
   - Performance budget and chunking expectations

Do not provide generic recommendations; provide implementation-ready workflows and acceptance criteria.
