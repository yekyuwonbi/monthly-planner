create table if not exists public.planner_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  planner_state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.planner_profiles enable row level security;

create policy "planner_profiles_select_own"
on public.planner_profiles
for select
to authenticated
using (auth.uid() = user_id);

create policy "planner_profiles_insert_own"
on public.planner_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "planner_profiles_update_own"
on public.planner_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('planner-backgrounds', 'planner-backgrounds', true)
on conflict (id) do nothing;

drop policy if exists "planner_backgrounds_insert_own" on storage.objects;
create policy "planner_backgrounds_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'planner-backgrounds'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "planner_backgrounds_update_own" on storage.objects;
create policy "planner_backgrounds_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'planner-backgrounds'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'planner-backgrounds'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "planner_backgrounds_delete_own" on storage.objects;
create policy "planner_backgrounds_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'planner-backgrounds'
  and (storage.foldername(name))[1] = auth.uid()::text
);
