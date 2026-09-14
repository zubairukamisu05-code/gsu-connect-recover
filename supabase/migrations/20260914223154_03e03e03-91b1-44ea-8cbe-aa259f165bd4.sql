create type public.app_role as enum ('admin', 'moderator', 'user');
create type public.user_type as enum ('student', 'staff');
create type public.item_category as enum ('electronics', 'documents', 'wallets', 'keys', 'bags', 'clothing', 'books', 'accessories', 'other');
create type public.item_status as enum ('open', 'matched', 'claimed', 'returned', 'closed');
create type public.claim_status as enum ('pending', 'approved', 'rejected');

create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  identifier text not null unique,
  user_type public.user_type not null,
  display_name text not null,
  email text,
  department text not null,
  faculty text not null,
  avatar_path text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Users can view their own profile" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "Users can create their own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
create policy "Users can update their own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create policy "Users can view their own roles" on public.user_roles for select to authenticated using (auth.uid() = user_id);
create policy "Admins can manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admins can manage profiles" on public.profiles for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.lost_items (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  category public.item_category not null,
  description text not null,
  location text not null,
  date_lost date not null,
  image_path text,
  status public.item_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.lost_items to authenticated;
grant all on public.lost_items to service_role;
alter table public.lost_items enable row level security;
create policy "Authenticated users can browse lost items" on public.lost_items for select to authenticated using (status <> 'closed' or reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users can report lost items" on public.lost_items for insert to authenticated with check (reporter_id = auth.uid());
create policy "Users can update their lost items" on public.lost_items for update to authenticated using (reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin')) with check (reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users and admins can remove lost items" on public.lost_items for delete to authenticated using (reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.found_items (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  category public.item_category not null,
  description text not null,
  location text not null,
  date_found date not null,
  kept_at text not null,
  image_path text,
  status public.item_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.found_items to authenticated;
grant all on public.found_items to service_role;
alter table public.found_items enable row level security;
create policy "Authenticated users can browse found items" on public.found_items for select to authenticated using (status <> 'closed' or reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users can report found items" on public.found_items for insert to authenticated with check (reporter_id = auth.uid());
create policy "Users can update their found items" on public.found_items for update to authenticated using (reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin')) with check (reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users and admins can remove found items" on public.found_items for delete to authenticated using (reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  lost_item_id uuid not null references public.lost_items(id) on delete cascade,
  found_item_id uuid not null references public.found_items(id) on delete cascade,
  match_score integer not null default 0,
  match_reason text not null,
  created_at timestamptz not null default now(),
  unique (lost_item_id, found_item_id)
);
grant select, insert, update, delete on public.matches to authenticated;
grant all on public.matches to service_role;
alter table public.matches enable row level security;
create policy "Users can view matches for visible items" on public.matches for select to authenticated using (
  exists (select 1 from public.lost_items l where l.id = lost_item_id and (l.reporter_id = auth.uid() or l.status <> 'closed' or public.has_role(auth.uid(), 'admin')))
  or exists (select 1 from public.found_items f where f.id = found_item_id and (f.reporter_id = auth.uid() or f.status <> 'closed' or public.has_role(auth.uid(), 'admin')))
);
create policy "System can create matches" on public.matches for insert to authenticated with check (
  exists (select 1 from public.lost_items l where l.id = lost_item_id and (l.reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
  or exists (select 1 from public.found_items f where f.id = found_item_id and (f.reporter_id = auth.uid() or public.has_role(auth.uid(), 'admin')))
);
create policy "Admins can manage matches" on public.matches for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  claimant_id uuid not null references auth.users(id) on delete cascade,
  found_item_id uuid not null references public.found_items(id) on delete cascade,
  message text not null,
  status public.claim_status not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (claimant_id, found_item_id)
);
grant select, insert, update, delete on public.claims to authenticated;
grant all on public.claims to service_role;
alter table public.claims enable row level security;
create policy "Users can view their own claims" on public.claims for select to authenticated using (claimant_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users can create claims" on public.claims for insert to authenticated with check (claimant_id = auth.uid());
create policy "Users can update pending claims" on public.claims for update to authenticated using (claimant_id = auth.uid() and status = 'pending' or public.has_role(auth.uid(), 'admin')) with check (claimant_id = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Users can delete pending claims" on public.claims for delete to authenticated using (claimant_id = auth.uid() and status = 'pending' or public.has_role(auth.uid(), 'admin'));

create or replace function public.create_item_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_table_name = 'lost_items' then
    insert into public.matches (lost_item_id, found_item_id, match_score, match_reason)
    select new.id, f.id,
      40 + case when lower(f.item_name) = lower(new.item_name) then 35 else 15 end
      + case when f.category = new.category then 15 else 0 end
      + case when f.location = new.location then 10 else 0 end,
      'Similar name, category, location, and nearby date'
    from public.found_items f
    where f.status in ('open', 'matched')
      and (lower(f.item_name) = lower(new.item_name) or f.category = new.category)
      and f.location = new.location
      and f.date_found between new.date_lost - 7 and new.date_lost + 7
    on conflict (lost_item_id, found_item_id) do nothing;
  else
    insert into public.matches (lost_item_id, found_item_id, match_score, match_reason)
    select l.id, new.id,
      40 + case when lower(l.item_name) = lower(new.item_name) then 35 else 15 end
      + case when l.category = new.category then 15 else 0 end
      + case when l.location = new.location then 10 else 0 end,
      'Similar name, category, location, and nearby date'
    from public.lost_items l
    where l.status in ('open', 'matched')
      and (lower(l.item_name) = lower(new.item_name) or l.category = new.category)
      and l.location = new.location
      and new.date_found between l.date_lost - 7 and l.date_lost + 7
    on conflict (lost_item_id, found_item_id) do nothing;
  end if;
  return new;
end;
$$;

create trigger create_lost_item_matches after insert on public.lost_items for each row execute function public.create_item_matches();
create trigger create_found_item_matches after insert on public.found_items for each row execute function public.create_item_matches();
create trigger update_profiles_updated_at before update on public.profiles for each row execute function public.update_updated_at_column();
create trigger update_lost_items_updated_at before update on public.lost_items for each row execute function public.update_updated_at_column();
create trigger update_found_items_updated_at before update on public.found_items for each row execute function public.update_updated_at_column();
create trigger update_claims_updated_at before update on public.claims for each row execute function public.update_updated_at_column();

create index lost_items_reporter_id_idx on public.lost_items (reporter_id);
create index lost_items_search_idx on public.lost_items (category, location, date_lost);
create index found_items_reporter_id_idx on public.found_items (reporter_id);
create index found_items_search_idx on public.found_items (category, location, date_found);
create index matches_found_item_id_idx on public.matches (found_item_id);
create index claims_status_idx on public.claims (status);