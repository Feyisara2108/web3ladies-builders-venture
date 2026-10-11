import { supabase } from '@/lib/supabaseClient'
import type {
  AttendanceRecord,
  Cohort,
  CohortInviteLink,
  CohortStatus,
  IntakeForm,
  MentorAssignment,
  MentorComment,
  Project,
  ProjectStage,
  ProgressUpdate,
  Role,
  Session,
  SessionStatus,
  Settings,
  User,
} from '@/types'

export async function listCohorts(): Promise<Cohort[]> {
  const [{ data: cohortRows, error: cohortErr }, { data: userRows, error: userErr }] =
    await Promise.all([
      supabase.from('cohorts').select('*').order('start_date', { ascending: false }),
      supabase.from('users').select('cohort_id, role'),
    ])

  if (cohortErr) throw cohortErr
  if (userErr) throw userErr

  const counts = new Map<string, { student_count: number; mentor_count: number }>()
  for (const row of userRows ?? []) {
    if (!row.cohort_id) continue
    const entry = counts.get(row.cohort_id) ?? { student_count: 0, mentor_count: 0 }
    if (row.role === 'student') entry.student_count += 1
    if (row.role === 'mentor') entry.mentor_count += 1
    counts.set(row.cohort_id, entry)
  }

  return (cohortRows ?? []).map((row) => ({
    ...row,
    student_count: counts.get(row.id)?.student_count ?? 0,
    mentor_count: counts.get(row.id)?.mentor_count ?? 0,
  }))
}

export async function createCohort(input: {
  name: string
  programme?: string
  start_date: string
  end_date: string
}): Promise<Cohort> {
  const { data, error } = await supabase.from('cohorts').insert(input).select().single()
  if (error) throw error
  return { ...data, student_count: 0, mentor_count: 0 }
}

export async function getCohort(id: string): Promise<Cohort> {
  const [{ data: cohortRow, error: cohortErr }, { data: userRows, error: userErr }] =
    await Promise.all([
      supabase.from('cohorts').select('*').eq('id', id).single(),
      supabase.from('users').select('role').eq('cohort_id', id),
    ])

  if (cohortErr) throw cohortErr
  if (userErr) throw userErr

  const student_count = (userRows ?? []).filter((u) => u.role === 'student').length
  const mentor_count = (userRows ?? []).filter((u) => u.role === 'mentor').length

  return { ...cohortRow, student_count, mentor_count }
}

export async function updateCohort(
  id: string,
  input: Partial<{
    name: string
    programme: string | null
    start_date: string
    end_date: string
    status: CohortStatus
    discord_invite_url: string | null
    notion_url: string | null
  }>,
): Promise<Cohort> {
  const { error } = await supabase.from('cohorts').update(input).eq('id', id)
  if (error) throw error
  return getCohort(id)
}

export async function deleteCohort(id: string): Promise<void> {
  const { error } = await supabase.from('cohorts').delete().eq('id', id)
  if (error) throw error
}

export async function getActiveInviteLink(cohortId: string): Promise<CohortInviteLink | null> {
  const { data, error } = await supabase
    .from('cohort_invite_links')
    .select('*')
    .eq('cohort_id', cohortId)
    .eq('revoked', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function createInviteLink(cohortId: string, createdBy: string): Promise<CohortInviteLink> {
  const { data, error } = await supabase
    .from('cohort_invite_links')
    .insert({ cohort_id: cohortId, created_by: createdBy })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function revokeInviteLink(id: string): Promise<void> {
  const { error } = await supabase.from('cohort_invite_links').update({ revoked: true }).eq('id', id)
  if (error) throw error
}

export async function getCohortInviteInfo(
  token: string,
): Promise<{ cohort_name: string; valid: boolean } | null> {
  const { data, error } = await supabase.rpc('get_cohort_invite_info', { p_token: token })
  if (error) throw error
  return data?.[0] ?? null
}

export async function joinCohort(input: {
  token: string
  email: string
  full_name: string
  password: string
}): Promise<void> {
  const { error } = await supabase.functions.invoke('join-cohort', { body: input })
  if (error) throw error
}

export async function listSessions(): Promise<Session[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .order('start_time', { ascending: true })

  if (error) throw error
  return data ?? []
}

export async function createSession(input: {
  cohort_id: string
  title: string
  type: Session['type']
  stage?: ProjectStage | null
  start_time: string
  end_time: string
  facilitator_id: string
  location: Session['location']
  link?: string | null
  description?: string | null
  learning_objectives?: string | null
  resources_url?: string | null
}): Promise<Session> {
  const { data, error } = await supabase.from('sessions').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateSession(
  id: string,
  input: Partial<{
    cohort_id: string
    title: string
    type: Session['type']
    stage: ProjectStage | null
    start_time: string
    end_time: string
    facilitator_id: string
    location: Session['location']
    link: string | null
    learning_objectives: string | null
    resources_url: string | null
    status: SessionStatus
    description: string | null
  }>,
): Promise<Session> {
  const { data, error } = await supabase.from('sessions').update(input).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function getUserNames(ids: string[]): Promise<{ id: string; full_name: string }[]> {
  if (ids.length === 0) return []
  const { data, error } = await supabase.rpc('get_user_names', { p_ids: ids })
  if (error) throw error
  return data ?? []
}

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase.from('settings').select('*').eq('id', true).single()
  if (error) throw error
  return data
}

export async function updateSettings(
  input: Partial<Omit<Settings, 'id' | 'updated_at'>>,
): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', true)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function inviteUser(input: {
  email: string
  full_name: string
  role: Role
  cohort_id?: string | null
}): Promise<void> {
  const { error } = await supabase.functions.invoke('invite-user', { body: input })
  if (error) throw error
}

export async function updateUser(
  userId: string,
  input: { role: Role; cohort_id: string | null },
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(input)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function setUserActive(userId: string, active: boolean): Promise<User> {
  const { data, error } = await supabase.functions.invoke('set-user-active', {
    body: { user_id: userId, active },
  })
  if (error) throw error
  return data.user
}

export async function getUser(id: string): Promise<User> {
  const { data, error } = await supabase.from('users').select('*').eq('id', id).single()
  if (error) throw error
  return data
}

export async function getProjectByStudentId(studentId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function updateOwnProfile(
  userId: string,
  input: Partial<Pick<User, 'full_name' | 'bio' | 'timezone' | 'discord_handle' | 'wallet_address'>>,
): Promise<User> {
  const { data, error } = await supabase
    .from('users')
    .update(input)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function markInviteAccepted(userId: string): Promise<void> {
  const { error } = await supabase
    .from('users')
    .update({ invite_accepted_at: new Date().toISOString() })
    .eq('id', userId)
    .is('invite_accepted_at', null)

  if (error) throw error
}

export async function getIntakeForm(studentId: string): Promise<IntakeForm | null> {
  const { data, error } = await supabase
    .from('intake_forms')
    .select('*')
    .eq('student_id', studentId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function saveIntakeForm(input: {
  student_id: string
  motivation: string
  experience_level: IntakeForm['experience_level']
  goals: string
}): Promise<IntakeForm> {
  const { data, error } = await supabase
    .from('intake_forms')
    .upsert(input, { onConflict: 'student_id' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function listStudentsByCohort(cohortId?: string): Promise<User[]> {
  let query = supabase.from('users').select('*').eq('role', 'student')
  if (cohortId) query = query.eq('cohort_id', cohortId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listMentorsByCohort(cohortId?: string): Promise<User[]> {
  let query = supabase.from('users').select('*').eq('role', 'mentor')
  if (cohortId) query = query.eq('cohort_id', cohortId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function listMentorAssignments(filter?: {
  mentorId?: string
  studentIds?: string[]
}): Promise<MentorAssignment[]> {
  let query = supabase.from('mentor_assignments').select('*')
  if (filter?.mentorId) query = query.eq('mentor_id', filter.mentorId)
  if (filter?.studentIds) query = query.in('student_id', filter.studentIds)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function assignMentorToStudents(
  mentorId: string,
  studentIds: string[],
  assignedBy: string,
): Promise<void> {
  if (studentIds.length === 0) return
  const { error } = await supabase.from('mentor_assignments').upsert(
    studentIds.map((studentId) => ({
      mentor_id: mentorId,
      student_id: studentId,
      assigned_by: assignedBy,
    })),
    { onConflict: 'mentor_id,student_id' },
  )
  if (error) throw error
}

export async function unassignMentorFromStudent(mentorId: string, studentId: string): Promise<void> {
  const { error } = await supabase
    .from('mentor_assignments')
    .delete()
    .eq('mentor_id', mentorId)
    .eq('student_id', studentId)

  if (error) throw error
}

export async function listProgressUpdatesForStudents(studentIds: string[]): Promise<ProgressUpdate[]> {
  if (studentIds.length === 0) return []
  const { data, error } = await supabase
    .from('progress_updates')
    .select('*')
    .in('student_id', studentIds)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function listProgressUpdatesByStudent(studentId: string): Promise<ProgressUpdate[]> {
  const { data, error } = await supabase
    .from('progress_updates')
    .select('*')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function createProgressUpdate(input: {
  project_id: string
  student_id: string
  summary: string
  blockers?: string
}): Promise<ProgressUpdate> {
  const { data, error } = await supabase.from('progress_updates').insert(input).select().single()
  if (error) throw error
  return data
}

export async function listMentorComments(filter?: {
  mentorId?: string
  studentId?: string
  projectId?: string
}): Promise<MentorComment[]> {
  let query = supabase.from('mentor_comments').select('*').order('created_at', { ascending: false })
  if (filter?.mentorId) query = query.eq('mentor_id', filter.mentorId)
  if (filter?.studentId) query = query.eq('student_id', filter.studentId)
  if (filter?.projectId) query = query.eq('project_id', filter.projectId)
  const { data, error } = await query
  if (error) throw error
  return data ?? []
}

export async function createMentorComment(input: {
  project_id: string
  mentor_id: string
  student_id: string
  comment: string
  rating?: MentorComment['rating']
}): Promise<MentorComment> {
  const { data, error } = await supabase.from('mentor_comments').insert(input).select().single()
  if (error) throw error
  return data
}

export async function listAttendanceForStudents(studentIds: string[]): Promise<AttendanceRecord[]> {
  if (studentIds.length === 0) return []
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .in('student_id', studentIds)

  if (error) throw error
  return data ?? []
}

export async function listAttendanceForSession(sessionId: string): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from('attendance_records')
    .select('*')
    .eq('session_id', sessionId)

  if (error) throw error
  return data ?? []
}

export async function upsertAttendance(
  records: {
    session_id: string
    student_id: string
    status: AttendanceRecord['status']
    marked_by: string
  }[],
): Promise<void> {
  const { error } = await supabase
    .from('attendance_records')
    .upsert(records, { onConflict: 'session_id,student_id' })

  if (error) throw error
}

export async function listUsers(): Promise<User[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function listProjects(): Promise<Project[]> {
  const { data, error } = await supabase.from('projects').select('*')
  if (error) throw error
  return data ?? []
}

export async function createProject(input: {
  student_id: string
  cohort_id: string
  name: string
  problem_statement?: string
  solution?: string
}): Promise<Project> {
  const { data, error } = await supabase.from('projects').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateProjectDetails(
  projectId: string,
  input: Partial<
    Pick<
      Project,
      'name' | 'problem_statement' | 'solution' | 'description' | 'demo_url' | 'repo_url' | 'pitch_deck_url'
    >
  >,
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update(input)
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateProjectStage(
  projectId: string,
  stage: ProjectStage,
): Promise<Project> {
  const { data, error } = await supabase
    .from('projects')
    .update({ current_stage: stage })
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data
}
