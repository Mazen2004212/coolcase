-- Token expiry must use the authoritative database clock; application host
-- clocks can drift and must not decide whether a provisioning capability is
-- valid.
alter table public.staff_signup_tokens
  alter column expires_at set default (now() + interval '5 minutes');

delete from public.staff_signup_tokens where expires_at <= now();
