import * as React from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarClock, Loader2, Users, MessageSquareText } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  listMentorComments,
  listProgressUpdatesForStudents,
  listProjects,
  listSessions,
  listStudentsForMentor,
  mentorCohortIds,
} from '@/data/queries'
import { formatDateTime, stageLabels, timeAgo } from '@/lib/format'
import type { MentorComment, Project, ProgressUpdate, Session, User } from '@/types'

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

const STALE_DAYS = 7

export function MentorDashboard() {
  const { user } = useAuth()

  const [students, setStudents] = React.useState<User[]>([])
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [progressUpdates, setProgressUpdates] = React.useState<ProgressUpdate[]>([])
  const [myComments, setMyComments] = React.useState<MentorComment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    listStudentsForMentor(user)
      .then(async ({ students: studentData }) => {
        const studentIds = studentData.map((s) => s.id)
        const [sessionData, projectData, updateData, commentData] = await Promise.all([
          listSessions(),
          listProjects(),
          listProgressUpdatesForStudents(studentIds),
          listMentorComments({ mentorId: user.id }),
        ])
        if (cancelled) return
        setStudents(studentData)
        setSessions(sessionData)
        setProjects(projectData)
        setProgressUpdates(updateData)
        setMyComments(commentData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load dashboard')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const cohortIds = mentorCohortIds(user, students)
  const upcoming = sessions
    .filter((s) => cohortIds.has(s.cohort_id) && new Date(s.start_time).getTime() >= Date.now())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 3)

  const needsAttention = students.filter((s) => {
    const updates = progressUpdates.filter((u) => u.student_id === s.id)
    if (updates.length === 0) return true
    const daysSince = (Date.now() - new Date(updates[0].created_at).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince > STALE_DAYS
  })

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
        title={`Welcome back, ${user.full_name.split(' ')[0]}`}
        description="Here's how your students are doing."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Students" value={students.length} icon={Users} />
        <StatCard
          label="Need attention"
          value={needsAttention.length}
          icon={AlertTriangle}
          hint="No update in 7+ days"
        />
        <StatCard label="Reviews given" value={myComments.length} icon={MessageSquareText} />
        <StatCard label="Upcoming sessions" value={upcoming.length} icon={CalendarClock} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Students needing attention</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/mentor/students">View all students</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {needsAttention.length === 0 && (
              <p className="text-sm text-muted-foreground">Everyone's on track. Nice.</p>
            )}
            {needsAttention.map((student) => {
              const project = projects.find((p) => p.student_id === student.id)
              return (
                <Link
                  key={student.id}
                  to={`/mentor/students/${student.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:bg-accent"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>{initials(student.full_name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{student.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {project ? project.name : 'No project yet'}
                      </p>
                    </div>
                  </div>
                  {project && (
                    <Badge variant="warning">{stageLabels[project.current_stage]}</Badge>
                  )}
                </Link>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming sessions</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/mentor/sessions">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {upcoming.map((session) => (
              <div key={session.id} className="rounded-lg border p-3">
                <p className="text-sm font-medium">{session.title}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(session.start_time)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your recent reviews</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {myComments.length === 0 && (
            <p className="text-sm text-muted-foreground">You haven't left feedback yet.</p>
          )}
          {myComments.slice(0, 3).map((comment) => (
            <div key={comment.id} className="rounded-lg border p-3 text-sm">
              <p>{comment.comment}</p>
              <p className="mt-2 text-xs text-muted-foreground">{timeAgo(comment.created_at)}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
