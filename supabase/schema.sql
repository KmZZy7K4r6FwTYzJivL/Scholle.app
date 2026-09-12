-- Schorle Teller — groepsfunctionaliteit
-- Voer dit eenmalig uit in het Supabase dashboard: SQL Editor -> New query -> plak -> Run.

create extension if not exists "pgcrypto";

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  amount numeric not null default 1,
  created_at timestamptz not null default now()
);

-- Migratie voor wie deze schema.sql al eerder draaide vóór de halve-Schorle-optie:
alter table entries add column if not exists amount numeric not null default 1;

create index if not exists entries_group_id_idx on entries(group_id);
create index if not exists entries_member_id_idx on entries(member_id);
create index if not exists members_group_id_idx on members(group_id);

-- Tussenstand per groep: som van alle gelogde hoeveelheden (hele en halve Schorles) per lid.
create or replace view group_standings as
select
  m.group_id,
  m.id as member_id,
  m.name,
  coalesce(sum(e.amount), 0) as count,
  max(e.created_at) as last_at
from members m
left join entries e on e.member_id = m.id
group by m.group_id, m.id, m.name;

-- Deze app werkt zonder inloggen (alleen een naam), dus er is geen gebruikersauthenticatie
-- om lees/schrijfrechten op af te dwingen. De policies hieronder staan iedereen met de
-- (publieke) anon-key toe groepen te lezen/aanmaken en Schorles te loggen — vergelijkbaar
-- met een gedeeld scorebord onder vrienden. Geef de groepscode dus alleen aan mensen die je
-- vertrouwt.

alter table groups enable row level security;
alter table members enable row level security;
alter table entries enable row level security;

drop policy if exists "groups are publicly readable" on groups;
create policy "groups are publicly readable" on groups for select using (true);

drop policy if exists "anyone can create a group" on groups;
create policy "anyone can create a group" on groups for insert with check (true);

drop policy if exists "members are publicly readable" on members;
create policy "members are publicly readable" on members for select using (true);

drop policy if exists "anyone can join a group" on members;
create policy "anyone can join a group" on members for insert with check (true);

drop policy if exists "entries are publicly readable" on entries;
create policy "entries are publicly readable" on entries for select using (true);

drop policy if exists "anyone can log an entry" on entries;
create policy "anyone can log an entry" on entries for insert with check (true);

drop policy if exists "anyone can remove an entry" on entries;
create policy "anyone can remove an entry" on entries for delete using (true);

grant select on group_standings to anon, authenticated;

-- Realtime: laat live updates toe zodra iemand een Schorle logt of een groep joint.
-- (veilig om opnieuw te draaien: slaat over als de tabel al is toegevoegd)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'entries'
  ) then
    alter publication supabase_realtime add table entries;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'members'
  ) then
    alter publication supabase_realtime add table members;
  end if;
end $$;
