# NXTMinutes

<p align="center">
  <img src="./public/logo.svg" alt="NXTMinutes logo" width="420" />
</p>

Modern meeting minutes app with task tracking, templates, and collaborative preparation.

## Overview

`NXTMinutes` helps teams run structured meetings and follow up on action items.  
Minutes can be created visually or in Markdown mode, then managed consistently through the same data model.

## Current Feature Set

- Meeting series management with moderators, participants, and visibility rules
- Calendar-based planning with meeting events and RSVP tracking
- Minutes creation and editing (visual editor + Markdown editor mode)
- Markdown helpers: quick-insert snippets and `@` mention suggestions
- Protocol templates:
  - global templates (admin scope)
  - series templates (series scope)
  - template selection when creating a new minute
- Meeting-event to minutes flow (prepare/follow-up directly from planned meetings)
- Action-item lifecycle (status, priority, due date, responsibles, notes/decisions)
- Open task views and cross-series task import
- Club-function based responsibles and mention tokens
- PDF export and configurable PDF settings/layout
- User/admin management with role-based permissions
- Admin modules: system settings, users, templates, club functions, email config, PDF config
- Auth flows: login/logout, registration, email verification, forgot/reset password
- Browser push notifications (service worker + VAPID)
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
curl -fsSLO https://raw.githubusercontent.com/flacoonb/NXTminutes/main/install.sh
less install.sh
sudo bash install.sh
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
- `STRICT_CSP_MODE` (optional, production CSP toggle)
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL`
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (for web push)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (optional fallback for public key)
- `CRON_SECRET`

## Useful Scripts

- `npm run dev` - start dev server
- `npm run build` - production build
- `npm run start` - start production server
- `npm run lint` - lint
- `npm test` - test command placeholder (currently no automated tests)
- `npm run type-check` - TypeScript check
- `npm run security:check` - security regression checks for key hardening rules
- `npm run security:audit` - dependency audit (`npm audit --omit=dev --audit-level=high`)
- `npm run clean` - remove `.next` build artifacts
- `npm run rebuild` - clean and rebuild production bundle
- `npm run setup` - interactive setup script
- `npm run sample-data` - seed sample data
- `npm run migrate-identifiers` - migrate identifiers to user IDs
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

## Security Hardening

- Run `npm run security:check` locally and in CI to catch regressions in security-sensitive files.
- Keep `STRICT_CSP_MODE=false` unless you verified that strict CSP (`script-src 'self'`) works for your deployment.
- Scheduled dependency audit runs weekly via GitHub Actions (`Security Audit` workflow).

## Notes

- CI runs include lint/type-check/security-check/build.
- `npm test` is currently a placeholder and exits successfully.
- CodeQL runs in a separate GitHub Actions workflow.
- Dependabot PR auto-merge is configured for compatible updates.
- Username validation supports international letters (e.g., umlauts).
