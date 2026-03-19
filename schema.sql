-- ============================================================
-- ROAMR — Complete Database Schema
-- How to use:
--   1. Go to your Supabase project
--   2. Click "SQL Editor" in the left sidebar
--   3. Paste this entire file and click "Run"
-- ============================================================


-- ─── 1. PROFILES ─────────────────────────────────────────────
-- One row per user. Auto-created when someone signs up.

create table public.profiles (
  id         uuid references auth.users on delete cascade primary key,
  username   text unique,
  full_name  text,
  avatar_url text,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Anyone can read profiles (so author names show in the feed)
create policy "Profiles are public"
  on public.profiles for select using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─── 2. POSTS ────────────────────────────────────────────────
-- Each post is one community trip itinerary (a card in the feed)

create table public.posts (
  id           uuid default gen_random_uuid() primary key,
  author_id    uuid references public.profiles(id) on delete cascade not null,
  city         text not null,
  country      text not null,
  duration     integer not null default 1,
  cover_img    text,
  vibe         text,
  budget       text,   -- "$" | "$$" | "$$$" | "$$$$"
  caption      text,
  tips         text,
  coords_lat   double precision,
  coords_lng   double precision,
  adopt_count  integer default 0,
  like_count   integer default 0,
  created_at   timestamptz default now()
);

alter table public.posts enable row level security;

-- The feed is public — anyone (logged in or not) can read posts
create policy "Posts are public"
  on public.posts for select using (true);

-- Only the author can create/edit/delete their own posts
create policy "Authors can insert posts"
  on public.posts for insert with check (auth.uid() = author_id);

create policy "Authors can update own posts"
  on public.posts for update using (auth.uid() = author_id);

create policy "Authors can delete own posts"
  on public.posts for delete using (auth.uid() = author_id);


-- ─── 3. POST DAYS ────────────────────────────────────────────
-- Each post has one or more days (e.g. "day 1: south beach")

create table public.post_days (
  id       uuid default gen_random_uuid() primary key,
  post_id  uuid references public.posts(id) on delete cascade not null,
  day      integer not null,
  title    text,
  position integer default 0
);

alter table public.post_days enable row level security;

create policy "Post days are public"
  on public.post_days for select using (true);

create policy "Authors can manage post days"
  on public.post_days for all
  using (
    auth.uid() = (select author_id from public.posts where id = post_id)
  );


-- ─── 4. ACTIVITIES ───────────────────────────────────────────
-- Each day has one or more activities / places to visit

create table public.activities (
  id          uuid default gen_random_uuid() primary key,
  post_day_id uuid references public.post_days(id) on delete cascade not null,
  name        text not null,
  note        text,
  lat         double precision,
  lng         double precision,
  position    integer default 0
);

alter table public.activities enable row level security;

create policy "Activities are public"
  on public.activities for select using (true);

create policy "Authors can manage activities"
  on public.activities for all
  using (
    auth.uid() = (
      select p.author_id from public.posts p
      join public.post_days pd on pd.post_id = p.id
      where pd.id = post_day_id
    )
  );


-- ─── 5. LIKES ────────────────────────────────────────────────

create table public.likes (
  id      uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  unique (user_id, post_id)
);

alter table public.likes enable row level security;

create policy "Likes are public"
  on public.likes for select using (true);

create policy "Users can manage own likes"
  on public.likes for all using (auth.uid() = user_id);


-- ─── 6. ADOPTED TRIPS ────────────────────────────────────────
-- When a user clicks "adopt" on a community post

create table public.adopted_trips (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references public.profiles(id) on delete cascade not null,
  post_id    uuid references public.posts(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (user_id, post_id)
);

alter table public.adopted_trips enable row level security;

create policy "Users can see own adopted trips"
  on public.adopted_trips for select using (auth.uid() = user_id);

create policy "Users can manage own adopted trips"
  on public.adopted_trips for all using (auth.uid() = user_id);


-- ─── 7. SAVED PLACES ─────────────────────────────────────────
-- Heart / saved places pinned on the map

create table public.saved_places (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  activity_id uuid references public.activities(id) on delete cascade not null,
  post_id     uuid references public.posts(id) on delete cascade not null,
  created_at  timestamptz default now(),
  unique (user_id, activity_id)
);

alter table public.saved_places enable row level security;

create policy "Users can manage own saved places"
  on public.saved_places for all using (auth.uid() = user_id);


-- ==============================================================
-- 8. SEED DATA
-- Adds 4 community posts so the feed is not empty on first run.
-- These are attributed to a special "roamr team" profile.
-- You can delete this entire block if you prefer to start empty.
-- ==============================================================

do $$
declare
  seed_id uuid := '00000000-0000-0000-0000-000000000001';
  p1 uuid; p2 uuid; p3 uuid; p4 uuid;
  d  uuid;
begin

  -- Seed author profile
  insert into public.profiles (id, full_name, username)
  values (seed_id, 'roamr team', 'roamr')
  on conflict (id) do nothing;

  -- Miami
  insert into public.posts (id, author_id, city, country, duration, cover_img, vibe, budget, caption, tips, coords_lat, coords_lng, adopt_count, like_count)
  values (
    gen_random_uuid(), seed_id, 'Miami', 'USA', 3,
    'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80',
    'beach + nightlife', '$$',
    'the perfect long weekend. wynwood, rooftop sunsets, and the best ceviche of my actual life.',
    'book la mar 3 days ahead minimum. stay south of 15th st for the beach. ubers only.',
    25.7617, -80.1918, 47, 184
  ) returning id into p1;

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p1, 1, 'arrive and wynwood') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'The Elser Hotel',  'check in, drop bags',       25.7749, -80.1897, 0),
    (d, 'Wynwood Walls',    'street art, golden hour',   25.8004, -80.1999, 1),
    (d, 'Coyo Taco',        'tacos and mezcal',          25.8011, -80.1987, 2),
    (d, 'Lagniappe',        'wine bar, late night',      25.8021, -80.1948, 3);

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p1, 2, 'south beach') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'Ocean Drive',      'morning run on the strip',  25.7825, -80.1300, 0),
    (d, 'News Cafe',        'iconic brunch spot',        25.7807, -80.1307, 1),
    (d, 'La Mar',           'ceviche dinner, book ahead',25.7689, -80.1869, 2);

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p1, 3, 'design district and fly') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'Panther Coffee',   'best espresso in miami',    25.8128, -80.1971, 0),
    (d, 'Design District',  'browse the boutiques',      25.8134, -80.1942, 1),
    (d, 'Mandolin Aegean',  'farewell lunch',            25.8104, -80.1908, 2);

  -- Tokyo
  insert into public.posts (id, author_id, city, country, duration, cover_img, vibe, budget, caption, tips, coords_lat, coords_lng, adopt_count, like_count)
  values (
    gen_random_uuid(), seed_id, 'Tokyo', 'Japan', 7,
    'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
    'culture + food', '$$$',
    '7 days and i could have stayed forever. senso-ji at dawn before the crowds. ramen at midnight.',
    'get suica card at the airport immediately. 7-eleven onigiri is genuinely excellent. teamlab needs to be booked months out.',
    35.6762, 139.6503, 129, 412
  ) returning id into p2;

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p2, 1, 'shinjuku') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'Park Hyatt Tokyo', 'check in, decompress',      35.6866, 139.6907, 0),
    (d, 'Ichiran Ramen',    'solo booth ramen',          35.6897, 139.7009, 1),
    (d, 'Kabukicho',        'evening wander',            35.6939, 139.7034, 2);

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p2, 2, 'asakusa') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'Senso-ji Temple',  '6am - beat the crowds',     35.7148, 139.7967, 0),
    (d, 'Nakamise Street',  'shopping snacks',           35.7135, 139.7960, 1),
    (d, 'Akihabara',        'evening chaos (optional)',  35.7022, 139.7741, 2);

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p2, 3, 'shibuya and harajuku') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'Shibuya Crossing', 'rush hour is the move',     35.6595, 139.7006, 0),
    (d, 'Meiji Shrine',     'forested calm',             35.6763, 139.6993, 1),
    (d, 'Takeshita Street', 'harajuku fashion',          35.6702, 139.7027, 2);

  -- Lisbon
  insert into public.posts (id, author_id, city, country, duration, cover_img, vibe, budget, caption, tips, coords_lat, coords_lng, adopt_count, like_count)
  values (
    gen_random_uuid(), seed_id, 'Lisbon', 'Portugal', 5,
    'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=80',
    'culture + slow travel', '$$',
    'lisbon will hold you hostage and you won''t mind. tram 28, pastel de nata, and fado echoing through alfama at night.',
    'eating before 8pm is a tourist trap price-wise. bring a light jacket for evenings. tram 28 is magical but slow.',
    38.7223, -9.1393, 83, 267
  ) returning id into p3;

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p3, 1, 'alfama') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'Miradouro da Graca','sunset viewpoint, bring wine',38.7171, -9.1306, 0),
    (d, 'Tasca do Chico',   'fado dinner, book ahead',   38.7103, -9.1394, 1),
    (d, 'A Ginjinha',       'cherry liqueur shot',       38.7163, -9.1391, 2);

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p3, 2, 'belem') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'Pasteis de Belem', 'arrive before 10am!!',      38.6972, -9.2036, 0),
    (d, 'Torre de Belem',   'the iconic tower',          38.6916, -9.2160, 1),
    (d, 'MAAT Museum',      'contemporary art waterfront',38.6962, -9.2012, 2);

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p3, 3, 'sintra day trip') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'Pena Palace',           'fairy-tale on a hilltop',   38.7877, -9.3906, 0),
    (d, 'Quinta da Regaleira',   'mystical gardens and wells',38.7970, -9.3941, 1);

  -- New York
  insert into public.posts (id, author_id, city, country, duration, cover_img, vibe, budget, caption, tips, coords_lat, coords_lng, adopt_count, like_count)
  values (
    gen_random_uuid(), seed_id, 'New York', 'USA', 4,
    'https://images.unsplash.com/photo-1485871981521-5b1fd3805eee?w=800&q=80',
    'city break', '$$$',
    'nyc in 4 days - moma, the high line, a speakeasy in the east village, and bagels every single morning.',
    'metrocard is non-negotiable. no yellow cabs - ever. bodega coffee is actually great.',
    40.7128, -74.0060, 61, 203
  ) returning id into p4;

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p4, 1, 'downtown') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'One World Trade',  'start at the top',          40.7127, -74.0134, 0),
    (d, 'Eataly NYC',       'food hall heaven',          40.7421, -73.9893, 1);

  insert into public.post_days (id, post_id, day, title)
  values (gen_random_uuid(), p4, 2, 'midtown and culture') returning id into d;
  insert into public.activities (post_day_id, name, note, lat, lng, position) values
    (d, 'MOMA',             'give yourself 3-4 hours',   40.7614, -73.9776, 0),
    (d, 'High Line',        'afternoon walk, great views',40.7480, -74.0048, 1),
    (d, 'Chelsea Market',   'dinner wander',             40.7424, -74.0060, 2);

end $$;
