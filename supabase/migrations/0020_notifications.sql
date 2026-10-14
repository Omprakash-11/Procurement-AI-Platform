-- Backend Schema §2.18 — in-app notifications, soft read, purged after 90 days (0025)
create table public.notifications (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organisations(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  type         public.notification_type not null,
  title        text not null,
  body         text not null,
  entity_type  text, -- e.g. 'rfp', 'contract'
  entity_id    uuid, -- deep link target
  is_read      boolean not null default false,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_recipient_idx on public.notifications (recipient_id, is_read, created_at desc);
