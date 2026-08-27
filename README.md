# WorkMate English

WorkMate English is an AI-powered business English web service where users practice English through a simulated workday.

Instead of opening a separate study session, users start a virtual workday, receive role-based messages from colleagues, managers, and clients, respond in English, use hints when needed, and review their progress through daily reports.

## Core Features

- Personalized onboarding based on role, work domain, and English level
- Role-based English interactions with colleagues, managers, and clients
- Business-mode and game-mode learning flows
- Hint-assisted replies and follow-up AI feedback
- Daily work reports with corrections, key expressions, and review points
- Attendance, leave, and promotion systems for routine building
- Admin, CS, survey, and feedback-loop structures for MVP operation

## Tech Stack

- React 19
- TypeScript
- React Router 7
- Vite 6
- Tailwind CSS 4
- Supabase Auth and PostgreSQL
- Upstage Solar LLM (solar-pro2)
- Supabase Edge Functions (Deno) for the backend API
- Service Worker and Web Push (VAPID)
- GitHub Pages hosting with a GitHub Actions deployment workflow

## Getting Started

```bash
npm install
npm run dev
```

The frontend runs on Vite. The backend API is a Supabase Edge Function, so serve it
separately and point `VITE_API_BASE_URL` at it (see `docs/run-backend-local.md`).

## Environment Variables

Create a local `.env.local` file based on `.env.example`.

Browser-facing values use the `VITE_` prefix. Server-only values (Supabase service role
key, Solar API key, VAPID private key, cron secret) are never bundled into the frontend —
they are registered as Supabase Edge Function secrets.

## Deployment

Live service: https://www.enmate.co.kr

`.github/workflows/deploy.yml` runs on every push to `main` and deploys both halves:

- **Frontend** — `vite build` output published to GitHub Pages (custom domain `www.enmate.co.kr`)
- **Backend** — `supabase functions deploy api` for the Edge Function in `supabase/functions/api`

Scheduled notification dispatch (`/api/cron/dispatch`) runs daily through Supabase `pg_cron`.

The build and deploy steps read their configuration from repository secrets; see
`.github/workflows/deploy.yml` for the exact set. If the Supabase deployment secrets are
not configured, the workflow skips the Edge Function deployment and still publishes the
frontend.

## License

Copyright (c) 2026 ark-netizen. All rights reserved.

This repository is shared publicly for evaluation purposes only. No part of this
code may be copied, modified, or redistributed without prior written permission
from the copyright holder.
