# AWS serverless deployment plan

This document describes the approved deployment target. It does not create AWS resources.

## Architecture

Region: `eu-central-1` (Frankfurt).

```text
Browser
  -> CloudFront
       -> private S3: /_next/static/*, /assets/*, /media/*
       -> Lambda Function URL: every other request
            -> Next.js standalone on port 8080
            -> AWS Lambda Web Adapter 1.0.1
            -> Supabase PostgreSQL, Auth, RLS, RPCs, and private Storage
```

The Lambda function remains on-demand with no provisioned concurrency. The design does not require EC2, ECS, Fargate, RDS, a NAT Gateway, or a load balancer.

## Storage ownership

Supabase remains the source of truth for the database, authentication, RLS, RPCs, payment proofs, customer custom-case artwork, and historical Supabase-hosted public images. Payment proofs and customer artwork remain private and are never copied to S3.

The private S3 bucket stores repository-owned `public/**` assets, generated `.next/static/**` files, and new public product or custom-case-template media. Block Public Access stays enabled. CloudFront reads S3 through Origin Access Control (OAC); application uploads never use a public ACL.

New S3 media uses unique keys under:

- `media/products/<uuid>.webp`
- `media/custom-case-templates/<uuid>.webp`

The database stores the same-origin relative path, such as `/media/products/<uuid>.webp`. Historical Supabase storage paths and absolute URLs remain supported.

## Build and static staging

The repository remains the source of truth for `public/assets/**`.

```bash
npm ci
npm run build
npm run aws:static:prepare
```

For a local AWS-container smoke test, `.env.local` remains outside the Docker build context. Use the allowlisted build helper instead:

```bash
npm run aws:docker:build:test
```

The helper reads only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_APP_URL` from `.env.local` (or from the process environment), passes those three public values as Docker build arguments, and does not print their values. The test script overrides only `NEXT_PUBLIC_APP_URL` with `http://127.0.0.1:8080` so local absolute URLs match the mapped container port. Set `COOLCASE_DOCKER_ENV_FILE` to use a different local environment file. The helper never forwards server-only variables.

`aws:static:prepare` recreates `.aws-static/` with public URL-compatible paths:

- `public/assets/...` becomes `.aws-static/assets/...`
- `.next/static/...` becomes `.aws-static/_next/static/...`

The AWS container build sets `COOLCASE_AWS_BUILD=true`, which disables Next.js image optimization so S3-backed `/assets/*` and `/media/*` requests do not depend on files inside Lambda. This build-only flag is set by `Dockerfile.aws`; it is not an application secret.

## Cache policy

Use these object metadata and CloudFront policies:

| Path | Cache-Control | Deployment behavior |
| --- | --- | --- |
| `/_next/static/*` | `public,max-age=31536000,immutable` | Content-hashed; cache permanently. |
| `/media/*` | `public,max-age=31536000,immutable` | Every replacement gets a new UUID key. |
| `/assets/*` | `public,max-age=3600,s-maxage=86400` | Invalidate changed `/assets/*` paths after synchronization. |

Do not depend exclusively on `HERO_ASSET_VERSION`. If query-string cache busting is used, the selected CloudFront cache policy must include query strings.

During the final deployment, invalidate CloudFront `/assets/*` whenever canonical Hero, Auth, Logo, or Email artwork is replaced without a filename change. Transactional emails intentionally use the stable absolute `/assets/email/coolcase-email-header.png` URL, so deployment invalidation—not per-message random query parameters—is the cache refresh mechanism.

## ECR and Lambda

Create one private ECR repository for the Lambda container. Build `Dockerfile.aws` for the Lambda target architecture and push the immutable image digest.

The image uses Node.js 22 on Debian, Next.js standalone output, Sharp installed in Linux during `npm ci`, and AWS Lambda Web Adapter `1.0.1`. It listens on `0.0.0.0:8080` and runs as the non-root `node` user. Repository assets and `.next/static` are not copied into the runtime image.

Start Lambda with:

- Memory: 1024 MB
- Timeout: 30 seconds
- Architecture: test both `linux/amd64` and `linux/arm64`; prefer ARM64 only after the image and Sharp smoke tests pass for that target
- Provisioned concurrency: disabled
- Function URL: enabled for the CloudFront dynamic origin
- `AWS_LWA_PORT=8080`
- `AWS_LWA_READINESS_CHECK_PATH=/api/health`

The Lambda execution role needs `s3:PutObject` and `s3:DeleteObject` only for `arn:aws:s3:::<bucket>/media/*`. CloudFront receives read access through the bucket policy associated with its OAC. No static AWS access keys are configured in Lambda.

## CloudFront

Configure two origins:

1. Private S3 bucket with OAC.
2. Lambda Function URL as a custom HTTPS origin.

Configure ordered behaviors:

| Behavior | Origin | Methods | Caching |
| --- | --- | --- | --- |
| `/_next/static/*` | S3 | GET, HEAD | Long-lived immutable cache |
| `/assets/*` | S3 | GET, HEAD | Shorter cache plus deployment invalidation |
| `/media/*` | S3 | GET, HEAD | Long-lived immutable cache |
| Default `*` | Lambda Function URL | All methods required by Next.js | Disabled initially |

The default behavior must forward query strings, cookies, request bodies, and headers required by Next.js and Server Actions. It must support authenticated Supabase sessions, checkout POSTs, Admin mutations, and Server Action requests. Do not cache authenticated or dynamic HTML by default.

Set a strong random value as a CloudFront custom origin header:

```text
x-coolcase-origin-verify: <AWS_ORIGIN_VERIFY_SECRET>
```

Set the matching `AWS_ORIGIN_VERIFY_SECRET` only in Lambda runtime configuration. Requests missing the header receive HTTP 403, except `/api/health`, which remains available to the Lambda Web Adapter readiness check. Rotate this value by updating CloudFront and Lambda together.

Configure `SERVER_ACTION_ALLOWED_ORIGINS` as a comma-separated hostname list after the CloudFront hostname and production domains are known. Do not include protocols or paths.

## Environment variables

### Build-time public values

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`

These values are public by design and are supplied as Docker build arguments. `NEXT_PUBLIC_APP_URL` becomes the final CloudFront or custom HTTPS origin and is also used for absolute email links.

Next.js embeds `NEXT_PUBLIC_*` values into the application during `next build`. Changing any of these values therefore requires rebuilding and redeploying the Docker image; setting them only in the Lambda runtime environment cannot update the compiled client bundle.

### Lambda runtime secrets

- `SUPABASE_SERVICE_ROLE_KEY`
- `EMAIL_USER`
- `EMAIL_APP_PASSWORD`
- `AWS_ORIGIN_VERIFY_SECRET`

Store these in an AWS secret-management service and inject them at runtime. Do not pass them as Docker build arguments.

Production secrets must never be copied into the image, added to `.env` files in the Docker build context, or supplied through `--build-arg`.

### Lambda runtime configuration

- `PUBLIC_MEDIA_BACKEND=s3`
- `AWS_PUBLIC_MEDIA_BUCKET`
- `SERVER_ACTION_ALLOWED_ORIGINS`
- `EMAIL_HOST`
- `EMAIL_PORT`
- `EMAIL_SECURE`
- `EMAIL_FROM`
- `AWS_REGION` (provided by Lambda)

Local development defaults to `PUBLIC_MEDIA_BACKEND=supabase` and does not enforce the CloudFront origin header when `AWS_ORIGIN_VERIFY_SECRET` is absent.

## HTTPS and domain

Request an ACM certificate only after the production domain is selected. For CloudFront, the certificate must be in `us-east-1`. Add the final aliases to CloudFront, update DNS, then set `NEXT_PUBLIC_APP_URL` and `SERVER_ACTION_ALLOWED_ORIGINS` to the approved hostnames. No domain is hardcoded in the application.

## Deployment sequence for the infrastructure phase

1. Create a private S3 bucket in `eu-central-1` with Block Public Access enabled and object ownership enforced.
2. Create an ECR repository in `eu-central-1`.
3. Build and smoke-test `Dockerfile.aws` for the chosen Lambda architecture, then push the image by digest.
4. Create the Lambda execution role with CloudWatch Logs and scoped `media/*` Put/Delete permissions.
5. Create the on-demand Lambda function from the container image with 1024 MB memory, a 30-second timeout, no VPC attachment, and no provisioned concurrency.
6. Configure runtime variables and secrets, then create the Function URL.
7. Run `npm run build` and `npm run aws:static:prepare`; synchronize `.aws-static/` to S3 with the cache metadata described above.
8. Create a CloudFront OAC and distribution with the two origins and four behaviors in this document.
9. Add the origin-verification custom header and matching Lambda secret.
10. Verify health, storefront, authentication, Server Actions, checkout, Admin mutations, private uploads, and new S3 public-media upload/delete behavior through CloudFront.
11. Request and attach ACM/DNS configuration only after a domain is approved.

Live S3, ECR, Lambda, Function URL, IAM, and CloudFront tests are intentionally deferred until the infrastructure phase.
