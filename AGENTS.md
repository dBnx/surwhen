<!-- Copilot instructions for the SurWhen codebase -->
# SurWhen — Copilot instructions 

This file gives focused, actionable guidance to AI coding assistants working on this repository. Keep edits short and explicit; prefer small, type-safe changes.

- Big picture: Next.js (app router) TypeScript app that serves private surveys configured in `surveys.json`. Frontend pages live under `src/app/[locale]/*`. API endpoints are under `src/app/api/*` and run as Next.js server/runtime routes.

- Source of truth: `surveys.json` contains all surveys. Use `~/lib/surveys.ts` for reading/validation/hash logic and `~/lib/surveys.server.ts` for write operations (they update `surveys.json`). Hash = first 16 chars of sha256(title) (see `generateHashFromTitle`).

- Env & secrets: All server env vars are validated by `src/env.ts` via `@t3-oss/env-nextjs`. Required server vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `ADMIN_TOKEN`. Do not expose server envs to client. For local dev set `.env` or use `SKIP_ENV_VALIDATION` for Docker builds.

- Email flow: Submissions POST to `/api/submit` (see `src/app/api/submit/route.ts`) → `~/lib/email.ts` uses Nodemailer to send mail. Respect `getLocaleFromRequest` when returning localized error messages.

- Admin flow: Admin APIs require `ADMIN_TOKEN` passed as `?token=` or `x-admin-token` header (`src/app/api/admin/*`). Use `GET/POST/PUT/DELETE` on `/api/admin/surveys` and `PUT /api/admin/config` to manage surveys and default email.

- Type & safety rules (enforce): Do not introduce `any`. Keep `strict` TypeScript assumptions (see `tsconfig.json`). Use existing types: `Survey`, `SurveysConfig`, `SurveyWithHash`, and `EmailSubmission` from `~/lib/*`.

- Conventions & patterns to follow:
  - Use `~/lib/*` helpers for business logic; avoid duplicating hash/email/validation logic in pages or routes.
  - Server-only code (file IO, SMTP) must remain on server routes or files (avoid leaking into client bundles). Files under `src/lib/*.server.ts` indicate server operations.
  - Localization uses `next-intl` and namespaces under `src/i18n/messages/*`; server routes call `getTranslations({ locale, namespace })`.
  - Max string lengths are enforced in UI (e.g., `maxLength={1000}` for titles). Mirror those limits in server validation where appropriate.

- Useful files to inspect when making changes:
  - `surveys.json` — master survey config
  - `src/lib/surveys.ts` — hashing, validation, getters
  - `src/lib/surveys.server.ts` — read/write helpers for `surveys.json`
  - `src/lib/email.ts` — Nodemailer usage and message shape
  - `src/env.ts` — environment schema
  - `src/app/api/*/route.ts` — API behaviors, auth, and error handling
  - `src/app/[locale]/survey/[hash]/page.tsx` — submission form & client fetch to `/api/submit`

- Tests & build: There are no tests in repo. Use these commands for checks and dev:
  - Install: `pnpm install` (project uses pnpm)
  - Dev: `pnpm dev` (Next.js dev server)
  - Build: `pnpm build` then `pnpm start` or `pnpm preview`
  - Type & lint: `pnpm check` (runs `next lint` + `tsc --noEmit`)

- Small edits policy (when changing behavior):
  1. Update TypeScript types first. 2. Add/adjust server validation in `~/lib/surveys.ts` or `surveys.server.ts`. 3. Keep UI changes limited and use existing CSS classes.

- Examples (do this, not that):
  - Do: Use `getSurveyByHash(hash)` in pages instead of reimplementing hashing. (See `src/app/[locale]/survey/[hash]/page.tsx`.)
  - Do: In admin API, validate token with `env.ADMIN_TOKEN` and return NextResponse JSON with status codes (see `src/app/api/admin/*/route.ts`).
  - Don't: Read/write `surveys.json` directly outside `~/lib/surveys.server.ts`.

- When adding new env vars: add the schema to `src/env.ts` (server or client) and use `runtimeEnv` mapping. Use `emptyStringAsUndefined: true` rule.

- If unsure about runtime context, prefer server (route) implementation. Edge/client bundling can break access to Node built-ins (e.g., `crypto` used in `~/lib/surveys.ts` is ok on server; client should not import server-only helpers).

If anything in this file is unclear or incomplete, reply with which section you'd like expanded and mention the exact change you're going to make.
