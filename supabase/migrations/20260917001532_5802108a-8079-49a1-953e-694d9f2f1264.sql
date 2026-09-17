create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null,
  item_id uuid,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;
create policy "Users can view their own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "Users can mark their own notifications read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "System can create notifications" on public.notifications for insert to authenticated with check (user_id = auth.uid() or private.has_role(auth.uid(), 'admin'::public.app_role));
create policy "Users can remove their own notifications" on public.notifications for delete to authenticated using (user_id = auth.uid());
create index notifications_user_unread_idx on public.notifications (user_id, is_read, created_at desc);

create or replace function private.create_item_matches()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  match_row record;
  match_message text;
begin
  if tg_table_name = 'lost_items' then
    for match_row in
      select f.id, f.reporter_id, f.item_name, f.location,
        40 + case when lower(f.item_name) = lower(new.item_name) then 35 else 15 end
          + case when f.category = new.category then 15 else 0 end
          + case when f.location = new.location then 10 else 0 end as score
      from public.found_items f
      where f.status in ('open', 'matched')
        and (lower(f.item_name) like '%' || lower(new.item_name) || '%' or lower(new.item_name) like '%' || lower(f.item_name) || '%' or f.category = new.category)
        and f.location = new.location
        and f.date_found between new.date_lost - 7 and new.date_lost + 7
    loop
      insert into public.matches (lost_item_id, found_item_id, match_score, match_reason)
      values (new.id, match_row.id, match_row.score, 'Similar name, category, location, and nearby date')
      on conflict (lost_item_id, found_item_id) do nothing;
      match_message := 'Possible match found for your ' || new.item_name || ' at ' || new.location || '!';
      insert into public.notifications (user_id, message, item_id)
      values (new.reporter_id, match_message, new.id);
      if match_row.reporter_id <> new.reporter_id then
        insert into public.notifications (user_id, message, item_id)
        values (match_row.reporter_id, 'Possible match found for your ' || match_row.item_name || ' at ' || match_row.location || '!', match_row.id);
      end if;
    end loop;
  else
    for match_row in
      select l.id, l.reporter_id, l.item_name, l.location,
        40 + case when lower(l.item_name) = lower(new.item_name) then 35 else 15 end
          + case when l.category = new.category then 15 else 0 end
          + case when l.location = new.location then 10 else 0 end as score
      from public.lost_items l
      where l.status in ('open', 'matched')
        and (lower(l.item_name) like '%' || lower(new.item_name) || '%' or lower(new.item_name) like '%' || lower(l.item_name) || '%' or l.category = new.category)
        and l.location = new.location
        and new.date_found between l.date_lost - 7 and l.date_lost + 7
    loop
      insert into public.matches (lost_item_id, found_item_id, match_score, match_reason)
      values (match_row.id, new.id, match_row.score, 'Similar name, category, location, and nearby date')
      on conflict (lost_item_id, found_item_id) do nothing;
      match_message := 'Possible match found for your ' || new.item_name || ' at ' || new.location || '!';
      insert into public.notifications (user_id, message, item_id)
      values (new.reporter_id, match_message, new.id);
      if match_row.reporter_id <> new.reporter_id then
        insert into public.notifications (user_id, message, item_id)
        values (match_row.reporter_id, 'Possible match found for your ' || match_row.item_name || ' at ' || match_row.location || '!', match_row.id);
      end if;
    end loop;
  end if;
  return new;
end;
$$;

create or replace function private.notify_claim_parties()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  found_reporter uuid;
  found_name text;
  admin_row record;
begin
  select reporter_id, item_name into found_reporter, found_name from public.found_items where id = new.found_item_id;
  if tg_op = 'INSERT' then
    if found_reporter is not null and found_reporter <> new.claimant_id then
      insert into public.notifications (user_id, message, item_id)
      values (found_reporter, 'A claim was submitted for your found ' || coalesce(found_name, 'item') || '.', new.found_item_id);
    end if;
    for admin_row in select user_id from public.user_roles where role = 'admin'::public.app_role loop
      insert into public.notifications (user_id, message, item_id)
      values (admin_row.user_id, 'A new claim needs review for ' || coalesce(found_name, 'a found item') || '.', new.found_item_id);
    end loop;
  elsif new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    insert into public.notifications (user_id, message, item_id)
    values (new.claimant_id, 'Your claim for ' || coalesce(found_name, 'the found item') || ' was ' || new.status || '.', new.found_item_id);
  end if;
  return new;
end;
$$;
grant execute on function private.notify_claim_parties() to authenticated;
revoke execute on function private.notify_claim_parties() from anon;
create trigger notify_claim_parties_after_insert after insert on public.claims for each row execute function private.notify_claim_parties();
create trigger notify_claim_parties_after_update after update of status on public.claims for each row execute function private.notify_claim_parties();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;