-- Close a privilege-escalation hole: users_update_self lets anyone
-- update their own row, which (without this guard) includes role,
-- cohort_id, is_active and email — so a student could make themselves
-- an admin. Non-admins may still edit their own profile fields and
-- set invite_accepted_at. Service-role callers (Edge Functions, SQL
-- Editor) have no auth.uid() and are left alone.

create function public.protect_user_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null
     and public.current_user_role() is distinct from 'admin'
     and (
       new.role is distinct from old.role
       or new.cohort_id is distinct from old.cohort_id
       or new.is_active is distinct from old.is_active
       or new.email is distinct from old.email
     ) then
    raise exception 'Only admins can change role, cohort, active status, or email';
  end if;
  return new;
end;
$$;

create trigger protect_user_privileged_fields_trigger
  before update on public.users
  for each row execute function public.protect_user_privileged_fields();
