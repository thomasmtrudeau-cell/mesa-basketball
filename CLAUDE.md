# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start development server (localhost:3000)
npm run build    # Production build
npm run lint     # Run ESLint
```

There are no tests in this project.

## Architecture

This is a **Next.js 16 App Router** basketball training booking platform. The app lets parents register kids for group sessions, mini camps, and private training.

### Data Flow

- **Schedule data** comes from Google Sheets (fetched as CSV via public URLs) in `src/lib/sheets.ts`
- **Registrations** are stored in Supabase (PostgreSQL) via `src/lib/supabase.ts`
- **Email notifications** sent via Resend API in `src/lib/email.ts`
- **Business logic** lives in API routes (`src/app/api/`)

### Key Files

- `src/app/page.tsx` — Main home page; large client component with all session listing, filtering, and registration form state
- `src/app/api/register/route.ts` — Registration handler: capacity checks, referral validation, multi-session bookings
- `src/app/api/booking/[token]/route.ts` — Cancel/reschedule via token-based booking links
- `src/app/my-bookings/page.tsx` — User bookings dashboard (looks up bookings by email)
- `src/lib/supabase.ts` — All DB operations including referral credits and rewards logic
- `src/lib/demo-data.ts` — Mock session data used during development

### Database (Supabase)

Two main tables:
- `registrations` — all bookings (session dates, times, location, status, referral codes, free session flags)
- `referral_credits` — loyalty credit balances per email

Schema is in `supabase-migrations-rewards.sql`.

### Styling

Tailwind CSS v4 with a custom brown/gold theme. Custom CSS variables are defined in `src/app/globals.css`:
- `--color-mesa-dark` (#1a1a1a), `--color-mesa-brown` (#5c3d2e), `--color-mesa-accent` (#c4833e), `--color-mesa-light` (#fdf8f6)
- Full brown palette: `--color-brown-50` through `--color-brown-900`

### Path Aliases

`@/*` maps to `./src/*`.
