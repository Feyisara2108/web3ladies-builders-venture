-- Student self-serve: students can create their own project (one per
-- student, already enforced by projects.student_id unique) for the
-- cohort they're in, and can fill in / edit their own intake form.

-- ============================================================
-- Projects
-- ============================================================

create policy "projects_insert_self" on public.projects
  for insert with check (
    student_id = auth.uid()
    and public.current_user_role() = 'student'
    and cohort_id = (select cohort_id from public.users where id = auth.uid())
  );

-- Students can't pick their own starting stage — new student-created
-- projects always start at the programme's configured default stage.
create function public.set_new_project_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_user_role() = 'student' then
    new.current_stage := coalesce(
      (select default_stage from public.settings where id),
      'ideation'
    );
  end if;
  return new;
end;
$$;

create trigger set_new_project_stage_trigger
  before insert on public.projects
  for each row execute function public.set_new_project_stage();

-- ============================================================
-- Intake forms
-- ============================================================

create policy "intake_update_self" on public.intake_forms
  for update using (student_id = auth.uid()) with check (student_id = auth.uid());
