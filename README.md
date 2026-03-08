# 4Minitz 2.0

Modern meeting minutes app with task tracking, templates, and collaborative preparation.

## Overview

`4Minitz 2.0` helps teams run structured meetings and follow up on action items.  
Minutes can be created visually or in Markdown mode, then managed consistently through the same data model.

## Current Feature Set

- Meeting series management with moderators, participants, and visibility rules
- Minutes creation and editing (visual editor + Markdown editor mode)
- Markdown helpers: quick-insert snippets and `@` mention suggestions
- Protocol templates:
  - global templates (admin scope)
  - series templates (series scope)
  - template selection when creating a new minute
- Action-item lifecycle (status, priority, due date, responsibles, notes/decisions)
- Open task views and cross-series task import
- PDF export and configurable PDF settings/layout
- User/admin management with role-based permissions
- Auth flows: login/logout, registration, email verification, forgot/reset password
- i18n support (`de`, `en`)

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- React 19
- MongoDB + Mongoose 8
- Tailwind CSS 4
- JWT-based auth (with secure server-side permission checks)

## Quick Start

### Prerequisites

- Node.js 24+
- npm 11+
- MongoDB (local or remote)
- Docker (optional, but recommended for local DB setup)

### Option A: Full installer (recommended on fresh Linux setup)

```bash
curl -sL https://raw.githubusercontent.com/flacoonb/4minitz-2.0/main/install.sh | sudo bash
```

### Option B: Repository already cloned

```bash
npm run setup
```

`setup.sh` can:
- install dependencies
- create/update `.env.local`
- configure/start MongoDB container (optional)
- create demo user (optional)
- seed sample data (optional)

### Option C: Fully manual

```bash
npm ci
cp .env.example .env.local
npm run dev
```

App runs on: [http://localhost:3000](http://localhost:3000)

## Environment Variables

Use `.env.example` as source of truth. Important keys:

- `MONGODB_URI`
- `JWT_SECRET`
- `ENCRYPTION_SECRET`
- `APP_URL`
- `NEXT_PUBLIC_APP_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`
- `CRON_SECRET`

## Useful Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - lint
- `npm run type-check` - TypeScript check
- `npm run setup` - interactive setup script
- `npm run sample-data` - seed sample data
- `npm run create-demo-user` - create demo user
- `npm run create-user -- <email> <password> <firstName> <lastName>` - create user via CLI

## Initial Access

If demo user creation was enabled in setup:
- Email: `demo@example.com`
- Password: `demo123`

If not, create an admin manually:

```bash
npm run create-user -- admin@example.com mySecretPassword Admin User
```

## Project Structure (high level)

```text
app/          Next.js pages + API routes
components/   Reusable UI components
contexts/     React contexts (auth, etc.)
lib/          Core utilities (auth, permissions, db, email, markdown parser)
models/       Mongoose models
messages/     i18n translations
scripts/      Setup and data helper scripts
```

## Notes

- CI runs include lint/type-check/build and CodeQL.
- Dependabot PR auto-merge is configured for compatible updates.
- Username validation supports international letters (e.g., umlauts).
