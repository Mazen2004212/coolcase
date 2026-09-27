# Coolcase

Production e-commerce platform for customizable phone cases in Egypt. The repository contains the customer storefront, account and checkout flows, custom-case builders, the staff administration interface, and the Supabase database foundation.

## Stack

- Next.js 16 with the App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL, Auth, and Storage
- Zod and React Hook Form

## Local setup

Requirements:

- Node.js 20.9 or newer
- npm 11.
- A configured Supabase project

Copy `.env.example` to `.env.local` and provide the required local values. Never commit `.env.local` or production credentials.

```bash
npm install
npm run dev
```

The development server starts on `http://localhost:3000` by default.

## Environment variables

The application requires:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `NEXT_PUBLIC_APP_URL`

Transactional email uses `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_APP_PASSWORD`, and `EMAIL_FROM`. See `.env.example` for safe placeholders and defaults.

AWS deployments can select S3 for new public product and template media with `PUBLIC_MEDIA_BACKEND=s3`, while local development defaults to Supabase. Private payment proofs and customer artwork always remain in Supabase Storage. See the AWS deployment plan for the complete environment classification.

The Supabase verification and seed scripts use separate `COOLCASE_SUPABASE_*` variables so production credentials do not need to be exposed as public application variables.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
npm run test:storage
```

Linked Supabase runtime verification is available when its dedicated environment variables are configured:

```bash
npm run test:supabase:runtime
```

## Project structure

- `app/` — storefront, customer account, checkout, and admin routes
- `components/` — shared storefront, builder, and admin UI
- `lib/` — catalog, checkout, authentication, settings, email, and Supabase utilities
- `public/assets/` — production storefront and email assets
- `supabase/migrations/` — immutable database migrations
- `supabase/tests/` — SQL and runtime database tests
- `docs/` — product specification, schema, flows, and setup notes

## Documentation

- [Project specification](docs/PROJECT_SPEC.md)
- [Database schema](docs/DATABASE_SCHEMA.md)
- [User flows](docs/USER_FLOWS.md)
- [Supabase setup](docs/SUPABASE_SETUP.md)
- [AWS serverless deployment plan](docs/AWS_DEPLOYMENT.md)

## Security

All privileged Supabase and email credentials are server-only. Storage access, staff permissions, order transitions, payment verification, and authoritative checkout pricing are enforced by the application and database policies. Keep secrets in local or deployment environment configuration; do not add them to source control.
