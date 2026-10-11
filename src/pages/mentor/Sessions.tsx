import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  getUserNames,
  listAttendanceForStudents,
  listSessions,
  listStudentsForMentor,
  mentorCohortIds,
  upsertAttendance,
} from '@/data/queries'
import { formatDateTime } from '@/lib/format'
import type { AttendanceRecord, Session, User } from '@/types'
import { cn } from '@/lib/utils'

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

const statuses: AttendanceRecord['status'][] = ['present', 'absent', 'excused']

export function MentorSessions() {
  const { user } = useAuth()
  const [sessionsList, setSessionsList] = React.useState<Session[]>([])
  const [students, setStudents] = React.useState<User[]>([])
  const [facilitatorNames, setFacilitatorNames] = React.useState<{ id: string; full_name: string }[]>([])
  const [attendanceRecords, setAttendanceRecords] = React.useState<AttendanceRecord[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null)
  const [marks, setMarks] = React.useState<Record<string, AttendanceRecord['status']>>({})
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    listStudentsForMentor(user)
      .then(async ({ students: studentData }) => {
        const studentIds = studentData.map((s) => s.id)
        const [sessionData, attendanceData] = await Promise.all([
          listSessions(),
          listAttendanceForStudents(studentIds),
        ])
        const cohortIds = mentorCohortIds(user, studentData)
        const cohortSessions = sessionData.filter((s) => cohortIds.has(s.cohort_id))
        const facilitatorIds = [
          ...new Set(cohortSessions.map((s) => s.facilitator_id).filter((id): id is string => !!id)),
        ]
        const names = await getUserNames(facilitatorIds)
        if (cancelled) return
        setStudents(studentData)
        setSessionsList(cohortSessions)
        setFacilitatorNames(names)
        setAttendanceRecords(attendanceData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load sessions')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const activeSession = sessionsList.find((s) => s.id === activeSessionId)
  const studentsInSession = (sessionId: string | null) => {
    const session = sessionsList.find((s) => s.id === sessionId)
    return session ? students.filter((s) => s.cohort_id === session.cohort_id) : []
  }

  function openSession(sessionId: string) {
    const existing = attendanceRecords.filter((r) => r.session_id === sessionId)
    const initial: Record<string, AttendanceRecord['status']> = {}
    for (const student of studentsInSession(sessionId)) {
      const record = existing.find((r) => r.student_id === student.id)
      initial[student.id] = record?.status ?? 'present'
    }
    setMarks(initial)
    setSaveError(null)
    setActiveSessionId(sessionId)
  }

  async function handleSaveAttendance() {
    if (!activeSessionId) return
    setSaving(true)
    setSaveError(null)
    try {
      await upsertAttendance(
        studentsInSession(activeSessionId).map((student) => ({
          session_id: activeSessionId,
          student_id: student.id,
          status: marks[student.id] ?? 'present',
          marked_by: user.id,
        })),
      )
      const refreshed = await listAttendanceForStudents(students.map((s) => s.id))
      setAttendanceRecords(refreshed)
      setActiveSessionId(null)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError) {
    return <p className="text-sm text-destructive">{loadError}</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Sessions" description="Manage attendance for cohort sessions." />

      <div className="flex flex-col gap-3">
        {sessionsList.length === 0 && (
          <p className="text-sm text-muted-foreground">No sessions scheduled for your students' cohorts yet.</p>
        )}
        {sessionsList.map((session) => {
          const attendance = attendanceRecords.filter((r) => r.session_id === session.id)
          const expected = studentsInSession(session.id)
          return (
            <Card key={session.id}>
              <CardContent className="flex flex-col justify-between gap-3 pt-6 sm:flex-row sm:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{session.title}</p>
                    <Badge variant="outline" className="capitalize">
                      {session.type.replace('-', ' ')}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDateTime(session.start_time)} ·{' '}
                    {facilitatorNames.find((f) => f.id === session.facilitator_id)?.full_name ?? 'Unassigned'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {attendance.filter((r) => expected.some((s) => s.id === r.student_id)).length} of{' '}
                    {expected.length} marked
                  </p>
                </div>
                <Button size="sm" onClick={() => openSession(session.id)}>
                  Take attendance
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!activeSessionId} onOpenChange={(open) => !open && setActiveSessionId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{activeSession?.title}</DialogTitle>
            <DialogDescription>Mark each student's attendance for this session.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {studentsInSession(activeSessionId).map((student) => (
              <div
                key={student.id}
                className="flex flex-col gap-2 rounded-lg border p-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2">
                  <Avatar className="size-7">
                    <AvatarFallback className="text-xs">{initials(student.full_name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{student.full_name}</span>
                </div>
                <div className="flex gap-1">
                  {statuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setMarks((m) => ({ ...m, [student.id]: status }))}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xs font-medium capitalize transition-colors',
                        marks[student.id] === status
                          ? status === 'present'
                            ? 'border-success bg-success/15 text-success'
                            : status === 'excused'
                              ? 'border-foreground bg-accent'
                              : 'border-destructive bg-destructive/15 text-destructive'
                          : 'border-input text-muted-foreground hover:bg-accent',
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {saveError && <p className="text-sm text-destructive">{saveError}</p>}
          <DialogFooter>
            <Button onClick={handleSaveAttendance} disabled={saving}>
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save attendance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
