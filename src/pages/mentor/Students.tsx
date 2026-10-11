import * as React from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  listAttendanceForStudents,
  listProgressUpdatesForStudents,
  listProjects,
  listStudentsForMentor,
  type MentorStudentScope,
} from '@/data/queries'
import { stageLabels, timeAgo } from '@/lib/format'
import type { AttendanceRecord, Project, ProgressUpdate, User } from '@/types'

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

function attendanceRate(records: AttendanceRecord[], studentId: string) {
  const studentRecords = records.filter((r) => r.student_id === studentId)
  if (studentRecords.length === 0) return null
  const present = studentRecords.filter((r) => r.status === 'present').length
  return Math.round((present / studentRecords.length) * 100)
}

export function MentorStudents() {
  const { user } = useAuth()
  const [students, setStudents] = React.useState<User[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [progressUpdates, setProgressUpdates] = React.useState<ProgressUpdate[]>([])
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>([])
  const [scope, setScope] = React.useState<MentorStudentScope>('assigned')
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    listStudentsForMentor(user)
      .then(async ({ students: studentData, scope: studentScope }) => {
        const studentIds = studentData.map((s) => s.id)
        const [projectData, updateData, attendanceData] = await Promise.all([
          listProjects(),
          listProgressUpdatesForStudents(studentIds),
          listAttendanceForStudents(studentIds),
        ])
        if (cancelled) return
        setStudents(studentData)
        setScope(studentScope)
        setProjects(projectData)
        setProgressUpdates(updateData)
        setAttendance(attendanceData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load students')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

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
      <PageHeader
        title="Students"
        description={
          scope === 'assigned'
            ? 'Builders assigned to you.'
            : scope === 'cohort'
              ? "No students are assigned to you yet, so you're seeing your whole cohort."
              : undefined
        }
      />

      {students.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            You don't have any students yet. Ask an admin to assign students to you or add you to a cohort.
          </CardContent>
        </Card>
      )}

      {students.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Last update</TableHead>
                  <TableHead>Attendance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const project = projects.find((p) => p.student_id === student.id)
                  const updates = progressUpdates.filter((u) => u.student_id === student.id)
                  const rate = attendanceRate(attendance, student.id)
                  return (
                    <TableRow key={student.id} className="cursor-pointer">
                      <TableCell>
                        <Link
                          to={`/mentor/students/${student.id}`}
                          className="flex items-center gap-2 font-medium"
                        >
                          <Avatar className="size-7">
                            <AvatarFallback className="text-xs">
                              {initials(student.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          {student.full_name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {project?.name ?? '—'}
                      </TableCell>
                      <TableCell>
                        {project ? (
                          <Badge variant="outline">{stageLabels[project.current_stage]}</Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {updates[0] ? timeAgo(updates[0].created_at) : 'No updates'}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {rate === null ? '—' : `${rate}%`}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
