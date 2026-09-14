create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.has_role(uuid, public.app_role) set schema private;
alter function public.create_item_matches() set schema private;

alter function private.has_role(uuid, public.app_role) set search_path = public, private;
alter function private.create_item_matches() set search_path = public, private;

grant execute on function private.has_role(uuid, public.app_role) to authenticated;
grant execute on function private.create_item_matches() to authenticated;
revoke execute on function private.has_role(uuid, public.app_role) from anon;
revoke execute on function private.create_item_matches() from anon;