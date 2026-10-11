import * as React from 'react'
import { Loader2, Lock } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  createProject,
  getProjectByStudentId,
  listMentorComments,
  updateProjectDetails,
} from '@/data/queries'
import { stageLabels, stageOrder, timeAgo } from '@/lib/format'
import { cn, getErrorMessage } from '@/lib/utils'
import type { MentorComment, Project } from '@/types'

function CreateProjectCard({ onCreated }: { onCreated: (project: Project) => void }) {
  const { user } = useAuth()
  const [form, setForm] = React.useState({ name: '', problem_statement: '', solution: '' })
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!user.cohort_id) {
    return (
      <Card>
        <CardContent className="pt-6 text-sm text-muted-foreground">
          You're not in a cohort yet, so you can't start a project. Ask your admin to add you to one.
        </CardContent>
      </Card>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !user.cohort_id) return
    setSubmitting(true)
    setError(null)
    try {
      const created = await createProject({
        student_id: user.id,
        cohort_id: user.cohort_id,
        name: form.name.trim(),
        problem_statement: form.problem_statement || undefined,
        solution: form.solution || undefined,
      })
      onCreated(created)
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create project'))
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Start your project</CardTitle>
        <CardDescription>
          Give it a working name — you can change everything later. Your mentor will move it through the stages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-name">Project name</Label>
            <Input
              id="new-name"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-problem">Problem statement (optional)</Label>
            <Textarea
              id="new-problem"
              rows={2}
              value={form.problem_statement}
              onChange={(e) => setForm((f) => ({ ...f, problem_statement: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-solution">Solution (optional)</Label>
            <Textarea
              id="new-solution"
              rows={2}
              value={form.solution}
              onChange={(e) => setForm((f) => ({ ...f, solution: e.target.value }))}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div>
            <Button type="submit" disabled={submitting || !form.name.trim()}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Create project
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}

export function StudentWorkspace() {
  const { user } = useAuth()
  const [project, setProject] = React.useState<Project | null>(null)
  const [comments, setComments] = React.useState<MentorComment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [form, setForm] = React.useState({
    name: '',
    problem_statement: '',
    solution: '',
    description: '',
    demo_url: '',
    repo_url: '',
    pitch_deck_url: '',
  })
  const [saving, setSaving] = React.useState(false)
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    getProjectByStudentId(user.id)
      .then(async (projectData) => {
        if (cancelled) return
        setProject(projectData)
        if (projectData) {
          setForm({
            name: projectData.name ?? '',
            problem_statement: projectData.problem_statement ?? '',
            solution: projectData.solution ?? '',
            description: projectData.description ?? '',
            demo_url: projectData.demo_url ?? '',
            repo_url: projectData.repo_url ?? '',
            pitch_deck_url: projectData.pitch_deck_url ?? '',
          })
          const commentData = await listMentorComments({ projectId: projectData.id })
          if (!cancelled) setComments(commentData)
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load workspace')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

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

  if (!project) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Workspace" description="You don't have a project yet." />
        <CreateProjectCard
          onCreated={(created) => {
            setProject(created)
            setForm({
              name: created.name ?? '',
              problem_statement: created.problem_statement ?? '',
              solution: created.solution ?? '',
              description: created.description ?? '',
              demo_url: created.demo_url ?? '',
              repo_url: created.repo_url ?? '',
              pitch_deck_url: created.pitch_deck_url ?? '',
            })
          }}
        />
      </div>
    )
  }

  function handleChange(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      setSaved(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!project) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await updateProjectDetails(project.id, form)
      setProject(updated)
      setSaved(true)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const stageIndex = stageOrder.indexOf(project.current_stage)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Workspace" description="Manage your project details. Stage is set by your mentor." />

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-2">
            {stageOrder.map((stage, i) => (
              <div key={stage} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className={cn(
                    'h-1.5 w-full rounded-full',
                    i <= stageIndex ? 'bg-primary' : 'bg-muted',
                  )}
                />
                <span
                  className={cn(
                    'text-xs',
                    i === stageIndex ? 'font-semibold text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {stageLabels[stage]}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Project details</CardTitle>
              <CardDescription>Editable by you.</CardDescription>
            </div>
            <Badge variant="secondary" className="gap-1">
              <Lock className="size-3" />
              Stage: {stageLabels[project.current_stage]}
            </Badge>
          </CardHeader>
          <CardContent>
            <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="name">Project name</Label>
                <Input id="name" value={form.name} onChange={handleChange('name')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="problem_statement">Problem statement</Label>
                <Textarea
                  id="problem_statement"
                  rows={2}
                  value={form.problem_statement}
                  onChange={handleChange('problem_statement')}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="solution">Solution</Label>
                <Textarea id="solution" rows={2} value={form.solution} onChange={handleChange('solution')} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" rows={3} value={form.description} onChange={handleChange('description')} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="demo_url">Demo link</Label>
                  <Input id="demo_url" value={form.demo_url} onChange={handleChange('demo_url')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="repo_url">Repo link</Label>
                  <Input id="repo_url" value={form.repo_url} onChange={handleChange('repo_url')} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pitch_deck_url">Pitch deck link</Label>
                  <Input id="pitch_deck_url" value={form.pitch_deck_url} onChange={handleChange('pitch_deck_url')} />
                </div>
              </div>
              {saveError && <p className="text-sm text-destructive">{saveError}</p>}
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Save changes
                </Button>
                {saved && <span className="text-sm text-success">Saved</span>}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Mentor feedback</CardTitle>
            <CardDescription>On this project.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {comments.length === 0 && (
              <p className="text-sm text-muted-foreground">No feedback yet.</p>
            )}
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border p-3 text-sm">
                <p>{comment.comment}</p>
                <p className="mt-2 text-xs text-muted-foreground">{timeAgo(comment.created_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
