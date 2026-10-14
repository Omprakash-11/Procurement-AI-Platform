-- Backend Schema §2.4 — invite tokens, kept permanently for audit; expiry enforced in app logic
create table public.vendor_invites (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organisations(id) on delete cascade,
  rfp_id            uuid not null references public.rfps(id) on delete cascade,
  vendor_account_id uuid not null references public.vendor_accounts(id) on delete cascade,
  invited_by        uuid not null references public.profiles(id) on delete no action,
  token             text unique not null, -- cryptographically random, 64 chars
  status            public.invite_status not null default 'pending',
  personal_message  text,
  expires_at        timestamptz not null, -- created_at + 72 hours
  accepted_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index vendor_invites_token_idx on public.vendor_invites (token);
create index vendor_invites_rfp_idx on public.vendor_invites (rfp_id);
