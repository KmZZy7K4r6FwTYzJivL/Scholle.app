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

-- ---------------------------------------------------------------------------
-- Statistieken (voor stats.html)
-- ---------------------------------------------------------------------------
-- Twee functies die de app via supabase.rpc() aanroept. Ze rekenen alles in de
-- database uit en geven één JSON-object terug, zodat de statistiekenpagina met
-- één request toe kan. Tijden worden gegroepeerd in de tijdzone van de telefoon
-- (p_tz); een onbekende tijdzone valt terug op Europe/Berlin (Wurstmarkt-tijd).
-- Ze draaien als "security invoker", dus dezelfde RLS-regels als hierboven gelden.

create or replace function schorle_tz(p_tz text)
returns text
language sql
stable
as $$
  select coalesce((select name from pg_timezone_names where name = p_tz limit 1), 'Europe/Berlin');
$$;

-- Statistieken van één groep: totalen, verdeling per uur/dag en cijfers per lid.
create or replace function group_stats(p_group_id uuid, p_tz text default 'Europe/Berlin')
returns json
language plpgsql
stable
as $$
declare
  tz text := schorle_tz(p_tz);
  result json;
begin
  with e as (
    select amount, created_at, member_id
    from entries
    where group_id = p_group_id
  ),
  per_member as (
    select
      m.id as member_id,
      m.name,
      coalesce(sum(x.amount), 0) as total,
      count(x.created_at) as drinks,
      count(*) filter (where x.amount = 0.5) as halves,
      count(*) filter (where x.amount = 0) as alcohol_free,
      min(x.created_at) as first_at,
      max(x.created_at) as last_at
    from members m
    left join e x on x.member_id = m.id
    where m.group_id = p_group_id
    group by m.id, m.name
  )
  select json_build_object(
    'total', coalesce((select sum(amount) from e), 0),
    'drinks', (select count(*) from e),
    'halves', (select count(*) from e where amount = 0.5),
    'alcohol_free', (select count(*) from e where amount = 0),
    'members', (select count(*) from per_member),
    'first_at', (select min(created_at) from e),
    'last_at', (select max(created_at) from e),
    'by_hour', (
      select coalesce(json_agg(json_build_object('hour', h, 'total', t) order by h), '[]'::json)
      from (
        select extract(hour from created_at at time zone tz)::int as h, sum(amount) as t
        from e group by 1
      ) s
    ),
    'by_day', (
      select coalesce(json_agg(json_build_object('day', d, 'total', t) order by d), '[]'::json)
      from (
        select (created_at at time zone tz)::date as d, sum(amount) as t
        from e group by 1
      ) s
    ),
    'per_member', (
      select coalesce(json_agg(row_to_json(pm) order by pm.total desc, pm.name), '[]'::json)
      from per_member pm
    )
  ) into result;
  return result;
end;
$$;

-- Statistieken over alle gebruikers samen. Bevat bewust geen groepscodes of
-- namen van leden, alleen aantallen en de namen van de drukste groepen.
create or replace function global_stats(p_tz text default 'Europe/Berlin')
returns json
language plpgsql
stable
as $$
declare
  tz text := schorle_tz(p_tz);
  today date := (now() at time zone tz)::date;
  result json;
begin
  select json_build_object(
    'total', coalesce((select sum(amount) from entries), 0),
    'drinks', (select count(*) from entries),
    'halves', (select count(*) from entries where amount = 0.5),
    'alcohol_free', (select count(*) from entries where amount = 0),
    'groups', (select count(*) from groups),
    'members', (select count(*) from members),
    'today', coalesce((
      select sum(amount) from entries where (created_at at time zone tz)::date = today
    ), 0),
    'by_hour', (
      select coalesce(json_agg(json_build_object('hour', h, 'total', t) order by h), '[]'::json)
      from (
        select extract(hour from created_at at time zone tz)::int as h, sum(amount) as t
        from entries group by 1
      ) s
    ),
    'by_day', (
      select coalesce(json_agg(json_build_object('day', d, 'total', t) order by d), '[]'::json)
      from (
        select (created_at at time zone tz)::date as d, sum(amount) as t
        from entries group by 1
      ) s
    ),
    'top_groups', (
      select coalesce(json_agg(row_to_json(g) order by g.total desc), '[]'::json)
      from (
        select gr.name, count(distinct m.id) as members, coalesce(sum(en.amount), 0) as total
        from groups gr
        left join members m on m.group_id = gr.id
        left join entries en on en.member_id = m.id
        group by gr.id, gr.name
        order by total desc
        limit 5
      ) g
    )
  ) into result;
  return result;
end;
$$;

grant execute on function schorle_tz(text) to anon, authenticated;
grant execute on function group_stats(uuid, text) to anon, authenticated;
grant execute on function global_stats(text) to anon, authenticated;
