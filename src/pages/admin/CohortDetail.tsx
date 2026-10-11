import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  FolderKanban,
  Link2,
  Loader2,
  Pencil,
  Plus,
  TrendingUp,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  assignMentorToStudents,
  createInviteLink,
  createSession,
  deleteCohort,
  getActiveInviteLink,
  getCohort,
  listAttendanceForStudents,
  listMentorAssignments,
  listMentorsByCohort,
  listProgressUpdatesForStudents,
  listProjects,
  listSessions,
  listStudentsByCohort,
  listUsers,
  revokeInviteLink,
  unassignMentorFromStudent,
  updateCohort,
} from '@/data/queries'
import { formatDate, formatDateTime, nowForDateTimeInput, stageLabels, todayForDateInput } from '@/lib/format'
import type {
  AttendanceRecord,
  Cohort,
  CohortStatus,
  MentorAssignment,
  Project,
  ProgressUpdate,
  ProjectStage,
  Session,
  User,
} from '@/types'

const statusVariant: Record<CohortStatus, 'success' | 'outline' | 'secondary'> = {
  active: 'success',
  upcoming: 'outline',
  completed: 'secondary',
  archived: 'outline',
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

function attendanceRate(records: AttendanceRecord[], filterFn: (r: AttendanceRecord) => boolean) {
  const scoped = records.filter(filterFn)
  if (scoped.length === 0) return null
  const present = scoped.filter((r) => r.status === 'present').length
  return Math.round((present / scoped.length) * 100)
}

function EditCohortDialog({ cohort, onSaved }: { cohort: Cohort; onSaved: (c: Cohort) => void }) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    name: cohort.name,
    programme: cohort.programme ?? '',
    start_date: cohort.start_date,
    end_date: cohort.end_date,
    status: cohort.status,
    discord_invite_url: cohort.discord_invite_url ?? '',
    notion_url: cohort.notion_url ?? '',
  })
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Block picking a NEW past start date, but don't fight the browser's
  // native min-date validation on a cohort whose start date is already
  // in the past.
  const minStart = cohort.start_date < todayForDateInput() ? cohort.start_date : todayForDateInput()

  React.useEffect(() => {
    if (open) {
      setForm({
        name: cohort.name,
        programme: cohort.programme ?? '',
        start_date: cohort.start_date,
        end_date: cohort.end_date,
        status: cohort.status,
        discord_invite_url: cohort.discord_invite_url ?? '',
        notion_url: cohort.notion_url ?? '',
      })
      setError(null)
    }
  }, [open, cohort])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const updated = await updateCohort(cohort.id, {
        name: form.name,
        programme: form.programme || null,
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        discord_invite_url: form.discord_invite_url || null,
        notion_url: form.notion_url || null,
      })
      onSaved(updated)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save cohort')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> Edit Cohort
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit cohort</DialogTitle>
          <DialogDescription>Update details for {cohort.name}.</DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-name">Name</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-programme">Programme</Label>
            <Input
              id="edit-programme"
              value={form.programme}
              onChange={(e) => setForm((f) => ({ ...f, programme: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-start">Start date</Label>
              <Input
                id="edit-start"
                type="date"
                min={minStart}
                value={form.start_date}
                onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-end">End date</Label>
              <Input
                id="edit-end"
                type="date"
                min={form.start_date || minStart}
                value={form.end_date}
                onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as CohortStatus }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="upcoming">Upcoming</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-discord">Discord invite link</Label>
            <Input
              id="edit-discord"
              value={form.discord_invite_url}
              onChange={(e) => setForm((f) => ({ ...f, discord_invite_url: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-notion">Notion curriculum link</Label>
            <Input
              id="edit-notion"
              value={form.notion_url}
              onChange={(e) => setForm((f) => ({ ...f, notion_url: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddSessionDialog({
  cohortId,
  facilitators,
  onCreated,
}: {
  cohortId: string
  facilitators: User[]
  onCreated: (s: Session) => void
}) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    title: '',
    type: 'live-class' as Session['type'],
    stage: 'none' as ProjectStage | 'none',
    start_time: '',
    end_time: '',
    facilitator_id: '',
    location: 'discord' as Session['location'],
    link: '',
    description: '',
    learning_objectives: '',
    resources_url: '',
  })
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) setForm((f) => ({ ...f, facilitator_id: f.facilitator_id || (facilitators[0]?.id ?? '') }))
  }, [open, facilitators])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.start_time || !form.end_time || !form.facilitator_id) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createSession({
        cohort_id: cohortId,
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
      })
      onCreated(created)
      setForm({
        title: '',
        type: 'live-class',
        stage: 'none',
        start_time: '',
        end_time: '',
        facilitator_id: '',
        location: 'discord',
        link: '',
        description: '',
        learning_objectives: '',
        resources_url: '',
      })
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule session')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" /> Add Session
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Schedule session</DialogTitle>
          <DialogDescription>Add a new session to this cohort's calendar.</DialogDescription>
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
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="start-time">Start</Label>
              <Input
                id="start-time"
                type="datetime-local"
                min={nowForDateTimeInput()}
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="end-time">End</Label>
              <Input
                id="end-time"
                type="datetime-local"
                min={form.start_time || nowForDateTimeInput()}
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
                  {facilitators.map((fac) => (
                    <SelectItem key={fac.id} value={fac.id}>
                      {fac.full_name}
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
              <Label htmlFor="cd-link">Meeting link</Label>
              <Input
                id="cd-link"
                type="url"
                placeholder="https://meet.google.com/..."
                value={form.link}
                onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Students get a Join button with this link.</p>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="cd-description">Description</Label>
            <Textarea
              id="cd-description"
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cd-learning-objectives">Learning objectives</Label>
            <Textarea
              id="cd-learning-objectives"
              rows={2}
              value={form.learning_objectives}
              onChange={(e) => setForm((f) => ({ ...f, learning_objectives: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cd-resources-url">Resources (Notion page link)</Label>
            <Input
              id="cd-resources-url"
              value={form.resources_url}
              onChange={(e) => setForm((f) => ({ ...f, resources_url: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Schedule session
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AssignMentorDialog({
  mentors,
  students,
  assignments,
  onAssignmentsChanged,
}: {
  mentors: User[]
  students: User[]
  assignments: MentorAssignment[]
  onAssignmentsChanged: (next: MentorAssignment[]) => void
}) {
  const { user: currentAdmin } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [mentorId, setMentorId] = React.useState('')
  const [selectedStudentIds, setSelectedStudentIds] = React.useState<Set<string>>(new Set())
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setMentorId(mentors[0]?.id ?? '')
      setError(null)
    }
  }, [open, mentors])

  const currentAssignments = assignments.filter((a) => a.mentor_id === mentorId)
  const assignedStudentIds = new Set(currentAssignments.map((a) => a.student_id))

  function toggleStudent(studentId: string) {
    setSelectedStudentIds((prev) => {
      const next = new Set(prev)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  async function handleAssign() {
    if (!mentorId || selectedStudentIds.size === 0) return
    setBusy(true)
    setError(null)
    try {
      const ids = Array.from(selectedStudentIds)
      await assignMentorToStudents(mentorId, ids, currentAdmin.id)
      const newRows: MentorAssignment[] = ids.map((studentId) => ({
        id: `${mentorId}-${studentId}`,
        mentor_id: mentorId,
        student_id: studentId,
        assigned_by: currentAdmin.id,
        created_at: new Date().toISOString(),
      }))
      onAssignmentsChanged([
        ...assignments.filter(
          (a) => !(a.mentor_id === mentorId && selectedStudentIds.has(a.student_id)),
        ),
        ...newRows,
      ])
      setSelectedStudentIds(new Set())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign mentor')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(studentId: string) {
    setBusy(true)
    setError(null)
    try {
      await unassignMentorFromStudent(mentorId, studentId)
      onAssignmentsChanged(
        assignments.filter((a) => !(a.mentor_id === mentorId && a.student_id === studentId)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove assignment')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="size-4" /> Assign Mentor
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign mentor to students</DialogTitle>
          <DialogDescription>
            Pick a mentor from this cohort, then choose which students they're responsible for.
          </DialogDescription>
        </DialogHeader>
        {mentors.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No mentors are assigned to this cohort yet. Set a mentor's cohort on the Users page
            first, then come back here to assign them to specific students.
          </p>
        ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Mentor</Label>
            <Select value={mentorId} onValueChange={setMentorId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {mentors.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {currentAssignments.length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>Currently assigned</Label>
              <div className="flex flex-wrap gap-2">
                {currentAssignments.map((a) => {
                  const student = students.find((s) => s.id === a.student_id)
                  return (
                    <Badge key={a.id} variant="secondary" className="gap-1 pr-1">
                      {student?.full_name ?? 'Unknown'}
                      <button
                        type="button"
                        onClick={() => handleRemove(a.student_id)}
                        disabled={busy}
                        className="rounded-full p-0.5 hover:bg-background/60"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label>Add students</Label>
            <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-2">
              {students
                .filter((s) => !assignedStudentIds.has(s.id))
                .map((student) => (
                  <label
                    key={student.id}
                    className="flex items-center gap-2 rounded-sm px-1 py-1.5 text-sm hover:bg-accent"
                  >
                    <input
                      type="checkbox"
                      className="accent-primary"
                      checked={selectedStudentIds.has(student.id)}
                      onChange={() => toggleStudent(student.id)}
                    />
                    {student.full_name}
                  </label>
                ))}
              {students.filter((s) => !assignedStudentIds.has(s.id)).length === 0 && (
                <p className="px-1 py-1.5 text-sm text-muted-foreground">
                  Every student is already assigned to this mentor.
                </p>
              )}
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button onClick={handleAssign} disabled={busy || selectedStudentIds.size === 0}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Assign selected
            </Button>
          </DialogFooter>
        </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function InviteLinkDialog({ cohort }: { cohort: Cohort }) {
  const { user } = useAuth()
  const [open, setOpen] = React.useState(false)
  const [link, setLink] = React.useState<Awaited<ReturnType<typeof getActiveInviteLink>>>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getActiveInviteLink(cohort.id)
      .then((data) => {
        if (!cancelled) setLink(data)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load invite link')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, cohort.id])

  async function handleGenerate() {
    setBusy(true)
    setError(null)
    try {
      const created = await createInviteLink(cohort.id, user.id)
      setLink(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate link')
    } finally {
      setBusy(false)
    }
  }

  async function handleRevoke() {
    if (!link) return
    setBusy(true)
    setError(null)
    try {
      await revokeInviteLink(link.id)
      setLink(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke link')
    } finally {
      setBusy(false)
    }
  }

  const url = link ? `${window.location.origin}/join/${link.token}` : ''

  function handleCopy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Link2 className="size-4" /> Invite link
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join link for {cohort.name}</DialogTitle>
          <DialogDescription>
            Anyone with this link can create their own student account, auto-enrolled in this
            cohort. Expires 30 days after it's generated.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !link && (
          <Button onClick={handleGenerate} disabled={busy} className="w-fit">
            {busy && <Loader2 className="size-4 animate-spin" />}
            Generate link
          </Button>
        )}

        {!loading && link && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Input value={url} readOnly className="text-xs" />
              <Button type="button" variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                <span className="sr-only">Copy link</span>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Expires {formatDate(link.expires_at)} · used {link.use_count} time
              {link.use_count === 1 ? '' : 's'}
            </p>
            <DialogFooter>
              <Button type="button" variant="destructive" size="sm" onClick={handleRevoke} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Revoke link
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function DeleteCohortDialog({ cohort }: { cohort: Cohort }) {
  const navigate = useNavigate()
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function handleDelete() {
    setBusy(true)
    setError(null)
    try {
      await deleteCohort(cohort.id)
      navigate('/admin/cohorts', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete cohort')
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" /> Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {cohort.name}?</DialogTitle>
          <DialogDescription>
            This permanently deletes the cohort along with its sessions, projects, and any active
            invite link. Students and mentors assigned to it are not deleted — they'll just be
            unassigned from a cohort. This can't be undone.
          </DialogDescription>
        </DialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" />}
            Delete cohort
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AdminCohortDetail() {
  const { cohortId } = useParams<{ cohortId: string }>()

  const [cohort, setCohort] = React.useState<Cohort | null>(null)
  const [students, setStudents] = React.useState<User[]>([])
  const [mentors, setMentors] = React.useState<User[]>([])
  const [allUsers, setAllUsers] = React.useState<User[]>([])
  const [sessions, setSessions] = React.useState<Session[]>([])
  const [projects, setProjects] = React.useState<Project[]>([])
  const [attendance, setAttendance] = React.useState<AttendanceRecord[]>([])
  const [progressUpdates, setProgressUpdates] = React.useState<ProgressUpdate[]>([])
  const [assignments, setAssignments] = React.useState<MentorAssignment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!cohortId) {
      setLoading(false)
      return
    }
    let cancelled = false
    getCohort(cohortId)
      .then(async (cohortData) => {
        const [studentData, mentorData, sessionData, projectData, userData] = await Promise.all([
          listStudentsByCohort(cohortId),
          listMentorsByCohort(cohortId),
          listSessions(),
          listProjects(),
          listUsers(),
        ])
        const studentIds = studentData.map((s) => s.id)
        const [attendanceData, updateData, assignmentData] = await Promise.all([
          listAttendanceForStudents(studentIds),
          listProgressUpdatesForStudents(studentIds),
          listMentorAssignments({ studentIds }),
        ])
        if (cancelled) return
        setCohort(cohortData)
        setStudents(studentData)
        setMentors(mentorData)
        setAllUsers(userData)
        setSessions(sessionData.filter((s) => s.cohort_id === cohortId))
        setProjects(projectData.filter((p) => p.cohort_id === cohortId))
        setAttendance(attendanceData)
        setProgressUpdates(updateData)
        setAssignments(assignmentData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load cohort')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cohortId])

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError || !cohort) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={loadError ? 'Failed to load cohort' : 'Cohort not found'} description={loadError ?? undefined} />
        <Button variant="outline" asChild className="w-fit">
          <Link to="/admin/cohorts">
            <ArrowLeft className="size-4" /> Back to Cohorts
          </Link>
        </Button>
      </div>
    )
  }

  const overallAttendance = attendanceRate(attendance, () => true)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link to="/admin/cohorts">
            <ArrowLeft className="size-4" /> Back to Cohorts
          </Link>
        </Button>
        <PageHeader
          title={cohort.name}
          description={
            <span className="flex flex-wrap items-center gap-2">
              {cohort.programme && <Badge variant="secondary">{cohort.programme}</Badge>}
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="size-3.5" />
                {formatDate(cohort.start_date)} — {formatDate(cohort.end_date)}
              </span>
              <Badge variant={statusVariant[cohort.status]} className="capitalize">
                {cohort.status}
              </Badge>
            </span>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              <AssignMentorDialog
                mentors={mentors}
                students={students}
                assignments={assignments}
                onAssignmentsChanged={setAssignments}
              />
              <AddSessionDialog
                cohortId={cohort.id}
                facilitators={allUsers.filter((u) => u.role === 'mentor' || u.role === 'admin')}
                onCreated={(s) => setSessions((prev) => [...prev, s])}
              />
              <EditCohortDialog cohort={cohort} onSaved={setCohort} />
              <InviteLinkDialog cohort={cohort} />
              <DeleteCohortDialog cohort={cohort} />
            </div>
          }
        />
        {(cohort.discord_invite_url || cohort.notion_url) && (
          <div className="flex flex-wrap gap-4 text-sm">
            {cohort.discord_invite_url && (
              <a
                href={cohort.discord_invite_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Discord →
              </a>
            )}
            {cohort.notion_url && (
              <a
                href={cohort.notion_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Notion →
              </a>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Students" value={students.length} icon={Users} />
        <StatCard label="Mentors" value={mentors.length} icon={Users} />
        <StatCard label="Sessions" value={sessions.length} icon={Calendar} />
        <StatCard
          label="Attendance Rate"
          value={overallAttendance === null ? '—' : `${overallAttendance}%`}
          icon={TrendingUp}
        />
        <StatCard label="Progress Updates" value={progressUpdates.length} icon={FolderKanban} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Students</CardTitle>
        </CardHeader>
        <CardContent>
          {students.length === 0 ? (
            <p className="text-sm text-muted-foreground">No students in this cohort yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Attendance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((student) => {
                    const project = projects.find((p) => p.student_id === student.id)
                    const rate = attendanceRate(attendance, (r) => r.student_id === student.id)
                    return (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium">{student.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{project?.name ?? '—'}</TableCell>
                        <TableCell>
                          {project ? (
                            <Badge variant="outline">{stageLabels[project.current_stage]}</Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {rate === null ? '—' : `${rate}%`}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mentors</CardTitle>
        </CardHeader>
        <CardContent>
          {mentors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No mentors in this cohort yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mentor name</TableHead>
                    <TableHead>Assigned students</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mentors.map((mentor) => (
                    <TableRow key={mentor.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                            {initials(mentor.full_name)}
                          </span>
                          {mentor.full_name}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {assignments.filter((a) => a.mentor_id === mentor.id).length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions scheduled yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session title</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Attendance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => {
                    const rate = attendanceRate(attendance, (r) => r.session_id === session.id)
                    return (
                      <TableRow key={session.id}>
                        <TableCell className="font-medium">{session.title}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDateTime(session.start_time)}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {rate === null ? '—' : `${rate}%`}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">No projects yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Current stage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const student = students.find((s) => s.id === project.student_id)
                    return (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">{student?.full_name ?? '—'}</TableCell>
                        <TableCell className="text-muted-foreground">{project.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{stageLabels[project.current_stage]}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
