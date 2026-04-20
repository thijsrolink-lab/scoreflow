-- ============================================================
-- SCOREFLOW — Supabase database schema
-- Voer dit uit in Supabase SQL editor (Database → SQL Editor)
-- ============================================================

-- ── GEBRUIKERS ───────────────────────────────────────────────
create table if not exists gebruikers (
  id uuid primary key default gen_random_uuid(),
  auth_id uuid references auth.users(id) on delete cascade,
  voor text not null,
  ach text not null,
  email text not null unique,
  rol text not null default 'Speler' check (rol in ('Superadmin','Wedstrijdleider','Secretaris','Speler')),
  hcp numeric(4,1),
  lid text unique,
  ltype text default 'Volledig lid',
  gs text default 'M' check (gs in ('M','V')),
  jaar integer,
  tel text,
  aangemaakt timestamptz default now()
);

-- ── WEDSTRIJDEN ──────────────────────────────────────────────
create table if not exists wedstrijden (
  id uuid primary key default gen_random_uuid(),
  naam text not null,
  datum date not null,
  baan text default 'GCC Zeewolde',
  cr numeric(4,1) default 72.1,
  slope integer default 131,
  holes integer default 18 check (holes in (9,18)),
  vorm text default 'Stableford',
  rondes integer default 1,
  status text default 'concept' check (status in ('concept','gepubliceerd','gesloten','archief')),
  max_deelnemers integer default 72,
  hcp_max numeric(4,1) default 36,
  hcp_min numeric(4,1) default 0,
  hcp_perc integer default 100,
  esc text default 'geen',
  startgeld numeric(6,2) default 0,
  skins_pot numeric(6,2) default 0,
  inschrijf_open date,
  inschrijf_sluit date,
  omschrijving text,
  kleur text default 'ceg',
  aangemaakt timestamptz default now(),
  aangemaakt_door uuid references gebruikers(id)
);

-- ── INSCHRIJVINGEN ───────────────────────────────────────────
create table if not exists inschrijvingen (
  id uuid primary key default gen_random_uuid(),
  wid uuid not null references wedstrijden(id) on delete cascade,
  sid uuid not null references gebruikers(id) on delete cascade,
  datum timestamptz default now(),
  status text default 'ingeschreven' check (status in ('ingeschreven','wachtlijst','afgemeld')),
  opm text,
  unique(wid, sid)
);

-- ── SCORES ───────────────────────────────────────────────────
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  wid uuid not null references wedstrijden(id) on delete cascade,
  sid uuid not null references gebruikers(id) on delete cascade,
  ronde integer not null default 0,
  hole integer not null check (hole between 1 and 18),
  score integer check (score between 1 and 20),
  bijgewerkt timestamptz default now(),
  unique(wid, sid, ronde, hole)
);

-- ── FLIGHTS ──────────────────────────────────────────────────
create table if not exists flights (
  id uuid primary key default gen_random_uuid(),
  wid uuid not null references wedstrijden(id) on delete cascade,
  flight_nr integer not null,
  sid uuid not null references gebruikers(id) on delete cascade,
  starttijd time,
  unique(wid, sid)
);

-- ── NOTIFICATIES ─────────────────────────────────────────────
create table if not exists notificaties (
  id uuid primary key default gen_random_uuid(),
  wid uuid references wedstrijden(id) on delete set null,
  onderwerp text not null,
  inhoud text,
  ontvangers integer default 0,
  verzonden_door uuid references gebruikers(id),
  aangemaakt timestamptz default now()
);

create table if not exists notificaties_gelezen (
  notif_id uuid references notificaties(id) on delete cascade,
  gebruiker_id uuid references gebruikers(id) on delete cascade,
  gelezen_op timestamptz default now(),
  primary key(notif_id, gebruiker_id)
);

-- ── GROEPSWEDSTRIJDEN ────────────────────────────────────────
create table if not exists groepswedstrijden (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  naam text not null,
  datum date,
  baan text,
  holes integer default 18,
  vorm text default 'Stableford',
  startgeld numeric(6,2) default 0,
  omschrijving text,
  organisator_id uuid references gebruikers(id),
  aangemaakt timestamptz default now()
);

create table if not exists gw_deelnemers (
  id uuid primary key default gen_random_uuid(),
  gwid uuid not null references groepswedstrijden(id) on delete cascade,
  gebruiker_id uuid references gebruikers(id),
  gast_naam text,
  gast_hcp numeric(4,1),
  is_gast boolean default false,
  unique(gwid, gebruiker_id)
);

create table if not exists gw_scores (
  id uuid primary key default gen_random_uuid(),
  gwid uuid not null references groepswedstrijden(id) on delete cascade,
  deelnemer_id uuid not null references gw_deelnemers(id) on delete cascade,
  hole integer not null check (hole between 1 and 18),
  score integer check (score between 1 and 20),
  bijgewerkt timestamptz default now(),
  unique(gwid, deelnemer_id, hole)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table gebruikers enable row level security;
alter table wedstrijden enable row level security;
alter table inschrijvingen enable row level security;
alter table scores enable row level security;
alter table flights enable row level security;
alter table notificaties enable row level security;
alter table notificaties_gelezen enable row level security;
alter table groepswedstrijden enable row level security;
alter table gw_deelnemers enable row level security;
alter table gw_scores enable row level security;

-- Iedereen mag lezen (publiek leaderboard werkt ook zonder login)
create policy "Publiek lezen gebruikers" on gebruikers for select using (true);
create policy "Publiek lezen wedstrijden" on wedstrijden for select using (true);
create policy "Publiek lezen inschrijvingen" on inschrijvingen for select using (true);
create policy "Publiek lezen scores" on scores for select using (true);
create policy "Publiek lezen flights" on flights for select using (true);
create policy "Publiek lezen notificaties" on notificaties for select using (true);
create policy "Publiek lezen notif gelezen" on notificaties_gelezen for select using (true);
create policy "Publiek lezen groepswedstrijden" on groepswedstrijden for select using (true);
create policy "Publiek lezen gw deelnemers" on gw_deelnemers for select using (true);
create policy "Publiek lezen gw scores" on gw_scores for select using (true);

-- Alleen ingelogde gebruikers mogen schrijven
create policy "Auth schrijven gebruikers" on gebruikers for all using (auth.role() = 'authenticated');
create policy "Auth schrijven wedstrijden" on wedstrijden for all using (auth.role() = 'authenticated');
create policy "Auth schrijven inschrijvingen" on inschrijvingen for all using (auth.role() = 'authenticated');
create policy "Auth schrijven scores" on scores for all using (auth.role() = 'authenticated');
create policy "Auth schrijven flights" on flights for all using (auth.role() = 'authenticated');
create policy "Auth schrijven notificaties" on notificaties for all using (auth.role() = 'authenticated');
create policy "Auth schrijven notif gelezen" on notificaties_gelezen for all using (auth.role() = 'authenticated');
create policy "Auth schrijven groepswedstrijden" on groepswedstrijden for all using (auth.role() = 'authenticated');
create policy "Auth schrijven gw deelnemers" on gw_deelnemers for all using (auth.role() = 'authenticated');
create policy "Auth schrijven gw scores" on gw_scores for all using (auth.role() = 'authenticated');

-- ============================================================
-- HANDIGE VIEWS
-- ============================================================

-- Leaderboard view: scores per speler per wedstrijd gecombineerd
create or replace view leaderboard_view as
select
  w.id as wid,
  w.naam as wedstrijd,
  w.datum,
  w.vorm,
  w.holes,
  w.cr,
  w.slope,
  w.hcp_perc,
  w.esc,
  g.id as sid,
  g.voor,
  g.ach,
  g.hcp,
  s.ronde,
  s.hole,
  s.score
from wedstrijden w
join inschrijvingen i on i.wid = w.id and i.status = 'ingeschreven'
join gebruikers g on g.id = i.sid
left join scores s on s.wid = w.id and s.sid = g.id;

-- Inschrijvingen telling per wedstrijd
create or replace view wedstrijd_bezetting as
select
  w.id,
  w.naam,
  w.datum,
  w.max_deelnemers,
  count(case when i.status = 'ingeschreven' then 1 end) as ingeschreven,
  count(case when i.status = 'wachtlijst' then 1 end) as wachtlijst
from wedstrijden w
left join inschrijvingen i on i.wid = w.id
group by w.id, w.naam, w.datum, w.max_deelnemers;

-- ============================================================
-- DEMO DATA (optioneel — verwijder als je eigen data gebruikt)
-- ============================================================

-- Voeg demo wedstrijd toe
insert into wedstrijden (naam, datum, vorm, status, max_deelnemers, omschrijving)
values
  ('Clubkampioenschap 2025', '2025-06-14', 'Strokeplay', 'gepubliceerd', 72, 'Het jaarlijkse clubkampioenschap.'),
  ('Damesdag juni', '2025-06-21', 'Stableford', 'gepubliceerd', 36, 'Gezellige damesdag.'),
  ('Senioren open', '2025-07-19', 'Stableford', 'gepubliceerd', 60, 'Open voor senioren 55+.')
on conflict do nothing;
