# Incline Gym Management System

## Project Overview
A comprehensive multi-branch gym management SaaS built with React, TypeScript, and Supabase. This is a pure frontend Vite/React SPA that connects directly to Supabase for authentication and database operations.

## Architecture
- **Frontend**: Vite + React 18 + TypeScript
- **UI**: Tailwind CSS + shadcn/ui (Radix UI primitives)
- **Auth & Database**: Supabase (PostgreSQL with RLS, Edge Functions)
- **State**: TanStack React Query for server state
- **Routing**: React Router v6

## Key Features
- Multi-branch management (owner, admin, manager, staff, trainer, member roles)
- Member management, memberships, billing & invoicing
- Attendance tracking (member + staff)
- Class bookings & PT sessions
- Benefits & facility slot booking
- Lockers & equipment management
- WhatsApp messaging (Meta Cloud API)
- Payment gateway (Razorpay/PhonePe)
- AI-generated fitness plans
- Hardware access control (biometric devices)
- Retention automation & lead management
- HRM, tasks, announcements
- Public website + embeddable lead form

## Environment Variables
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_PUBLISHABLE_KEY` - Supabase anon/publishable key
- `VITE_SUPABASE_PROJECT_ID` - Supabase project ID

## Running the App
```
npm run dev
```
Runs on the configured Vite development port.

## Supabase Edge Functions
Located in `supabase/functions/` — these run on Supabase infrastructure, not locally:
- `send-whatsapp` — Meta Cloud API WhatsApp messaging
- `payment-webhook` — Razorpay/PhonePe webhook handling
- `generate-fitness-plan` — AI fitness plan generation
- `run-retention-nudges` — Automated member retention
- `terminal-heartbeat` — Device heartbeat callback
- `terminal-identify` — Face identify callback
- `terminal-register` — Device register/roster callback
- And more...

## Database
Full schema in `supabase/migrations/` — 50+ migrations covering all entities.
The database is hosted on Supabase with Row Level Security (RLS) enforcing role-based access.

## Notes
- Supabase credentials are loaded from environment variables in local and deployed environments.
- This is a frontend-first architecture with Supabase services handling backend responsibilities.
