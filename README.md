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
- Upstage Solar LLM
- Vercel Serverless Functions
- GitHub Actions deployment workflow

## Getting Started

```bash
npm install
npm run dev
```

The local development server runs through Vite.

## Environment Variables

Create a local `.env` file based on `.env.example`.

Required values include Supabase and AI provider settings used by the serverless API.

## Deployment

The repository includes a GitHub Actions workflow for Vercel deployment.

To enable automatic deployment, configure these repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

If the secrets are not configured, the workflow skips deployment safely.
