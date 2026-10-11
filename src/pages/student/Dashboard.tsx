import * as React from 'react'
import { Link } from 'react-router-dom'
import { CalendarClock, CheckCircle2, Circle, FolderKanban, Loader2, MessageSquareText, TrendingUp } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  getIntakeForm,
  getProjectByStudentId,
  getUserNames,
  listMentorComments,
  listProgressUpdatesByStudent,
  listSessions,
} from '@/data/queries'
import { formatDateTime, timeAgo, stageLabels } from '@/lib/format'
import type { IntakeForm, MentorComment, Project, ProgressUpdate, Session } from '@/types'

export function StudentDashboard() {
  const { user } = useAuth()
  const [project, setProject] = React.useState<Project | null>(null)
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [facilitatorNames, setFacilitatorNames] = React.useState<{ id: string; full_name: string }[]>([])
  const [updates, setUpdates] = React.useState<ProgressUpdate[]>([])
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [intake, setIntake] = React.useState<IntakeForm | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([
      getProjectByStudentId(user.id),
      listSessions(),
      listProgressUpdatesByStudent(user.id),
      listMentorComments({ studentId: user.id }),
      getIntakeForm(user.id),
    ])
      .then(async ([projectData, sessionData, updateData, commentData, intakeData]) => {
        const facilitatorIds = [
          ...new Set(sessionData.map((s) => s.facilitator_id).filter((id): id is string => !!id)),
        ]
        const names = await getUserNames(facilitatorIds)
        if (cancelled) return
        setProject(projectData)
        setSessions(sessionData)
        setFacilitatorNames(names)
        setUpdates(updateData)
        setComments(commentData)
        setIntake(intakeData)
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
  }, [user.id])

  const upcoming = sessions
    .filter((s) => (!user.cohort_id || s.cohort_id === user.cohort_id) && new Date(s.start_time).getTime() >= Date.now())
    .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
    .slice(0, 3)
  const recentComments = comments.slice(0, 2)

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
        description="Here's what's happening in your builder journey."
      />

      {(!intake || !project || updates.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Get started</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {[
              { done: !!intake, label: 'Fill in your intake form', to: '/profile' },
              { done: !!project, label: 'Start your project', to: '/workspace' },
              { done: updates.length > 0, label: 'Post your first progress update', to: '/progress' },
            ].map((step) => (
              <Link
                key={step.to}
                to={step.to}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                {step.done ? (
                  <CheckCircle2 className="size-4 text-success" />
                ) : (
                  <Circle className="size-4 text-muted-foreground" />
                )}
                <span className={step.done ? 'text-muted-foreground line-through' : ''}>{step.label}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Project stage"
          value={project ? stageLabels[project.current_stage] : '—'}
          icon={FolderKanban}
          hint={project ? 'Set by your mentor' : 'No project yet'}
        />
        <StatCard
          label="Progress updates"
          value={updates.length}
          icon={TrendingUp}
          hint={updates[0] ? `Last update ${timeAgo(updates[0].created_at)}` : 'None yet'}
        />
        <StatCard
          label="Mentor feedback"
          value={comments.length}
          icon={MessageSquareText}
          hint="Total comments received"
        />
        <StatCard
          label="Upcoming sessions"
          value={upcoming.length}
          icon={CalendarClock}
          hint="This week"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Upcoming sessions</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/sessions">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {upcoming.length === 0 && (
              <p className="text-sm text-muted-foreground">No upcoming sessions scheduled.</p>
            )}
            {upcoming.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{session.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(session.start_time)} ·{' '}
                    {facilitatorNames.find((f) => f.id === session.facilitator_id)?.full_name ?? 'Unassigned'}
                  </p>
                </div>
                <Badge variant="outline" className="capitalize">
                  {session.type.replace('-', ' ')}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent feedback</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/progress">View all</Link>
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {recentComments.length === 0 && (
              <p className="text-sm text-muted-foreground">No mentor feedback yet.</p>
            )}
            {recentComments.map((comment) => (
              <div key={comment.id} className="rounded-lg border p-3">
                <p className="text-sm">{comment.comment}</p>
                <p className="mt-2 text-xs text-muted-foreground">{timeAgo(comment.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {project && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{project.name}</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link to="/workspace">Open project</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{project.description}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
