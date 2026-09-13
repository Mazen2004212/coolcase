# Coolcase Supabase setup

This phase defines the database, row-level security (RLS), storage policies, and
Supabase client factories. It does not connect Coolcase to a real project or
implement authentication, checkout, order creation, or admin workflows.

## Prerequisites

- Node.js 20.9 or newer and npm
- Supabase CLI 2.x (the commands below use an on-demand, major-version-pinned CLI)
- A Docker-compatible container runtime for the local Supabase stack
- A Supabase project only when deploying to a hosted environment

The repository intentionally does not commit project credentials or generated
local Supabase state.

## Start the local Supabase stack

The repository includes the generated `supabase/config.toml`, migrations, and
seed configuration. From the repository root, run:

```powershell
npx supabase@2 start
npx supabase@2 db reset
```

`db reset` rebuilds the local database from every file in
`supabase/migrations`, then runs `supabase/seed.sql`. It is destructive to the
local database and must not be used against production.

## Environment variables

Copy `.env.example` to `.env.local`, then copy the local API URL and anon key
reported by `supabase start`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key>
```

The checked-in browser and server client factories use only these public
values. `SUPABASE_SERVICE_ROLE_KEY` is reserved for future trusted server-only
operations. Never expose it through a `NEXT_PUBLIC_` variable, browser bundle,
log, or client response.

## Apply migrations to a hosted project

Create the project in the Supabase dashboard, then run:

```powershell
npx supabase@2 login
npx supabase@2 link --project-ref <project-ref>
npx supabase@2 db push --dry-run --include-seed
npx supabase@2 db push --include-seed
```

Review the dry-run output before applying migrations and deterministic seed
data. Do not use a linked database reset as a deployment workflow.

## Generate database types

No handwritten placeholder database types are included. Once the migrations
have been applied and validated locally, generate them from the database:

```powershell
npx supabase@2 gen types typescript --local --schema public > lib/supabase/database.types.ts
```

For a linked project, use:

```powershell
npx supabase@2 gen types typescript --project-id <project-ref> --schema public > lib/supabase/database.types.ts
```

After generation, pass the exported `Database` type to both Supabase client
factories. Regenerate the file after every schema migration. Keeping generated
types out of this phase prevents an unvalidated or fabricated schema contract
from becoming application source of truth.

## Seed data

`supabase/seed.sql` inserts only deterministic reference data:

- Seven initial storefront categories
- Silicone price: 150 EGP
- Acrylic price: 200 EGP
- Shipping fee: 50 EGP
- Currency: EGP

The seed uses conflict-safe inserts so a repeated local reset is deterministic.
It does not create users, products, orders, payments, analytics, or fake
statistics.

## Authentication profile behavior

An `auth.users` insert creates a matching `public.profiles` row. The trigger
always assigns `CUSTOMER`; it never trusts role data supplied in signup
metadata.

Database-only trigger and authorization helpers live in the non-exposed
`private` schema. Only authenticated users can execute `private.is_admin()`;
the remaining helper functions are trigger-only and have no Data API execution
grant.

After a real user has signed up, the first administrator must be promoted only
through a trusted SQL editor or a future service-role-only operation. Verify the
auth user UUID before running:

```sql
update public.profiles
set role = 'ADMIN'
where id = '<verified-auth-user-uuid>';
```

Do not expose role updates through signup metadata, a public form, or a browser
client.

## RLS expectations

- Anonymous and authenticated shoppers can read active categories, active
  products, images belonging to active products, and public store settings.
- Authenticated customers can manage only their own addresses. They can create
  and read their own private upload metadata, but cannot rewrite or delete it
  directly after submission.
- Customers can read only their own orders, order items, payments, and safe
  order-tracking fields.
- Database triggers keep order and order-item snapshots immutable, require
  payment terms to match the related order, and validate proof ownership/type
  and administrator verification attribution.
- A deferred integrity trigger requires every committed order to contain at
  least one item and requires `orders.subtotal_amount` to equal the sum of its
  item snapshots. Future order creation must therefore use one trusted database
  transaction or RPC.
- Upload records referenced by order items or payments cannot be deleted; the
  foreign keys preserve custom-design and payment-proof evidence.
- `public.order_tracking_events` excludes `internal_note`; internal history
  remains available only through trusted server-side access.
- Public/customer access to product images, store settings, payments, and
  history uses column privileges. Client queries must request the permitted
  columns explicitly instead of using `select('*')` on those base tables.
- Order creation, item creation, payment transitions, order status changes, and
  audit logging are trusted-server operations. Authenticated clients, including
  administrators, receive read-only commerce access through RLS.
- Catalog, product-image metadata, and store-setting mutations require an
  authenticated administrator. Application-level server authorization is still
  required when those admin workflows are implemented.
- The service role bypasses RLS. Every future service-role endpoint must perform
  its own authentication, authorization, and input validation.

The SSR server client includes cookie plumbing, but request-level session
refresh and auth routing are deliberately deferred to the authentication phase.

## Storage

The migrations create these buckets:

| Bucket | Visibility | Write access |
| --- | --- | --- |
| `product-assets` | Public read | Admin only |
| `custom-designs` | Private | Owner upload; trusted-server cleanup |
| `payment-proofs` | Private | Owner upload; trusted-server cleanup |

Private objects must use the authenticated user's UUID as the first path
segment, for example:

```text
<auth-user-uuid>/<server-generated-uuid>.webp
```

Buckets accept JPEG, PNG, WebP, and AVIF raster images. SVG is intentionally
excluded. No per-bucket maximum is invented in the migrations. The generated
local config retains Supabase CLI's 50 MiB global default, and the hosted
project's global limit also applies. Application validation and an agreed
per-workflow limit must be added before customer uploads go live.

Bucket MIME allow-lists use the client-supplied content type and are not a
substitute for server-side verification. Future upload handlers must verify the
actual file signature, decoded image integrity, extension, per-workflow size,
and a server-generated object name before recording upload metadata. Admins can
read private customer objects but cannot update or delete them through an
authenticated browser session.

The public `product-assets` bucket must contain publishable product imagery
only. Do not place customer uploads, payment evidence, secrets, or sensitive
source material in it.

## Production authentication configuration

`supabase/config.toml` is a local-development configuration, not an approved
production authentication policy. Before authentication is released, review
hosted-project email confirmation, password strength, CAPTCHA, redirect URLs,
rate limits, and SMTP settings in the Supabase dashboard. That work remains
deferred to the authentication phase.

## Validation checklist

After local Supabase is available:

```powershell
npx supabase@2 db reset
npx supabase@2 db lint --local
npm run lint
npm run typecheck
npm run build
```

Before production use, exercise the RLS matrix with separate anonymous,
customer, admin, and service-role sessions. In particular, verify cross-customer
address, upload, order, payment, and storage access is denied.
