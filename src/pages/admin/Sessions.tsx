import * as React from 'react'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog'
import { createSession, listCohorts, listSessions, listUsers, updateSession } from '@/data/queries'
import { formatDateTime, nowForDateTimeInput, stageLabels, toDateTimeInput } from '@/lib/format'
import { getErrorMessage } from '@/lib/utils'
import { useToast } from '@/lib/toast'
import type { Cohort, ProjectStage, Session, SessionStatus, User } from '@/types'

const statusVariant: Record<SessionStatus, 'success' | 'outline' | 'secondary' | 'destructive'> = {
  scheduled: 'outline',
  active: 'success',
  completed: 'secondary',
  cancelled: 'destructive',
}

type SessionForm = {
  title: string
  cohort_id: string
  type: Session['type']
  stage: ProjectStage | 'none'
  start_time: string
  end_time: string
  facilitator_id: string
  location: Session['location']
  link: string
  description: string
  learning_objectives: string
  resources_url: string
  status: SessionStatus
}

function emptyForm(defaultCohortId: string, defaultFacilitatorId: string): SessionForm {
  return {
    title: '',
    cohort_id: defaultCohortId,
    type: 'live-class',
    stage: 'none',
    start_time: '',
    end_time: '',
    facilitator_id: defaultFacilitatorId,
    location: 'discord',
    link: '',
    description: '',
    learning_objectives: '',
    resources_url: '',
    status: 'scheduled',
  }
}

function formFromSession(session: Session): SessionForm {
  return {
    title: session.title,
    cohort_id: session.cohort_id,
    type: session.type,
    stage: session.stage ?? 'none',
    start_time: toDateTimeInput(session.start_time),
    end_time: toDateTimeInput(session.end_time),
    facilitator_id: session.facilitator_id ?? '',
    location: session.location,
    link: session.link ?? '',
    description: session.description ?? '',
    learning_objectives: session.learning_objectives ?? '',
    resources_url: session.resources_url ?? '',
    status: session.status,
  }
}

function SessionDialog({
  session,
  cohorts,
  facilitators,
  onSaved,
}: {
  session?: Session
  cohorts: Cohort[]
  facilitators: User[]
  onSaved: (s: Session) => void
}) {
  const isEdit = !!session
  const { showToast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<SessionForm>(() =>
    session ? formFromSession(session) : emptyForm(cohorts[0]?.id ?? '', facilitators[0]?.id ?? ''),
  )
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Never let someone pick a NEW past date — but if we're editing a
  // session whose start time is already in the past, allow it to stay
  // there (or move later) rather than fighting the browser's native
  // min-date validation on an already-valid existing value.
  const minStart =
    session && new Date(session.start_time).getTime() < Date.now()
      ? toDateTimeInput(session.start_time)
      : nowForDateTimeInput()

  React.useEffect(() => {
    if (open) {
      setForm(session ? formFromSession(session) : emptyForm(cohorts[0]?.id ?? '', facilitators[0]?.id ?? ''))
      setError(null)
    }
  }, [open, session, cohorts, facilitators])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.cohort_id || !form.start_time || !form.end_time || !form.facilitator_id) {
      setError('Title, cohort, start, end, and facilitator are all required.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = {
        cohort_id: form.cohort_id,
        title: form.title,
        type: form.type,
        stage: form.stage === 'none' ? null : form.stage,
        start_time: new Date(form.start_time).toISOString(),
        end_time: new Date(form.end_time).toISOString(),
        facilitator_id: form.facilitator_id,
        location: form.location,
        link: form.location === 'in-person' ? null : form.link.trim() || null,
        description: form.description || null,
        learning_objectives: form.learning_objectives || null,
        resources_url: form.resources_url || null,
      }
      const saved = isEdit
        ? await updateSession(session.id, { ...payload, status: form.status })
        : await createSession(payload)
      onSaved(saved)
      setOpen(false)
      showToast(isEdit ? 'Session updated' : 'Session created')
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save session'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="icon" className="size-7">
            <Pencil className="size-3.5" />
            <span className="sr-only">Edit session</span>
          </Button>
        ) : (
          <Button size="sm">
            <Plus className="size-4" /> New session
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit session' : 'Schedule session'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update this session.' : "Add a new session to a cohort's calendar."}
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="session-title">Title</Label>
            <Input
              id="session-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Cohort</Label>
              <Select value={form.cohort_id} onValueChange={(v) => setForm((f) => ({ ...f, cohort_id: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {cohorts.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as Session['type'] }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="live-class">Live class</SelectItem>
                  <SelectItem value="workshop">Workshop</SelectItem>
                  <SelectItem value="office-hours">Office hours</SelectItem>
                  <SelectItem value="demo-day">Demo day</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Curriculum stage (optional)</Label>
              <Select
                value={form.stage}
                onValueChange={(v) => setForm((f) => ({ ...f, stage: v as ProjectStage | 'none' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {Object.entries(stageLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {isEdit && (
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm((f) => ({ ...f, status: v as SessionStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start-time">Start</Label>
              <Input
                id="start-time"
                type="datetime-local"
                min={minStart}
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end-time">End</Label>
              <Input
                id="end-time"
                type="datetime-local"
                min={form.start_time || minStart}
                value={form.end_time}
                onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Facilitator</Label>
              <Select
                value={form.facilitator_id}
                onValueChange={(v) => setForm((f) => ({ ...f, facilitator_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a facilitator" />
                </SelectTrigger>
                <SelectContent>
                  {facilitators.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Location</Label>
              <Select
                value={form.location}
                onValueChange={(v) => setForm((f) => ({ ...f, location: v as Session['location'] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discord">Discord</SelectItem>
                  <SelectItem value="zoom">Zoom</SelectItem>
                  <SelectItem value="google-meet">Google Meet</SelectItem>
                  <SelectItem value="in-person">In person</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.location !== 'in-person' && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="session-link">Meeting link</Label>
              <Input
                id="session-link"
                type="url"
                placeholder="https://meet.google.com/..."
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Students get a Join button with this link.</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="learning-objectives">Learning objectives</Label>
            <Textarea
              id="learning-objectives"
              rows={2}
              value={form.learning_objectives}
              onChange={(e) => setForm((f) => ({ ...f, learning_objectives: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="resources-url">Resources (Notion page link)</Label>
            <Input
              id="resources-url"
              value={form.resources_url}
              onChange={(e) => setForm((f) => ({ ...f, resources_url: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Save changes' : 'Schedule session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AdminSessions() {
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [cohorts, setCohorts] = React.useState<Cohort[]>([])
  const [users, setUsers] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([listSessions(), listCohorts(), listUsers()])
      .then(([sessionData, cohortData, userData]) => {
        if (cancelled) return
        setSessions(sessionData)
        setCohorts(cohortData)
        setUsers(userData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(getErrorMessage(err, 'Failed to load sessions'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const facilitators = users.filter((u) => u.role === 'mentor' || u.role === 'admin')

  const sorted = [...sessions].sort(
    (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sessions"
        description="Schedule live classes, workshops, and events across cohorts."
        action={
          !loading && !loadError ? (
            <SessionDialog
              cohorts={cohorts}
              facilitators={facilitators}
              onSaved={(s) => setSessions((prev) => [...prev, s])}
            />
          ) : undefined
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {loadError && !loading && <p className="text-sm text-destructive">{loadError}</p>}

      {!loading && !loadError && sorted.length === 0 && (
        <p className="text-sm text-muted-foreground">No sessions scheduled yet.</p>
      )}

      {!loading && !loadError && sorted.length > 0 && (
        <Card>
          <CardContent className="flex flex-col gap-3 pt-6">
            {sorted.map((session) => {
              const facilitator = users.find((u) => u.id === session.facilitator_id)
              return (
                <div
                  key={session.id}
                  className="flex flex-col justify-between gap-2 rounded-lg border p-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{session.title}</p>
                      <Badge variant="outline" className="capitalize">
                        {session.type.replace('-', ' ')}
                      </Badge>
                      <Badge variant={statusVariant[session.status]} className="capitalize">
                        {session.status}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDateTime(session.start_time)} · {facilitator?.full_name ?? 'Unassigned'} ·{' '}
                      {cohorts.find((c) => c.id === session.cohort_id)?.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-fit capitalize">
                      {session.location.replace('-', ' ')}
                    </Badge>
                    <SessionDialog
                      session={session}
                      cohorts={cohorts}
                      facilitators={facilitators}
                      onSaved={(updated) =>
                        setSessions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
                      }
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
