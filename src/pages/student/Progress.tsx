import * as React from 'react'
import { Link } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { PageHeader } from '@/components/PageHeader'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { createProgressUpdate, getProjectByStudentId, listProgressUpdatesByStudent } from '@/data/queries'
import { formatDate, timeAgo } from '@/lib/format'
import type { Project, ProgressUpdate } from '@/types'

export function StudentProgress() {
  const { user } = useAuth()
  const [project, setProject] = React.useState<Project | null>(null)
  const [updates, setUpdates] = React.useState<ProgressUpdate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  const [summary, setSummary] = React.useState('')
  const [blockers, setBlockers] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    Promise.all([getProjectByStudentId(user.id), listProgressUpdatesByStudent(user.id)])
      .then(([projectData, updateData]) => {
        if (cancelled) return
        setProject(projectData)
        setUpdates(updateData)
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load updates')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim() || !project) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const created = await createProgressUpdate({
        project_id: project.id,
        student_id: user.id,
        summary,
        blockers: blockers || undefined,
      })
      setUpdates((prev) => [created, ...prev])
      setSummary('')
      setBlockers('')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to post update')
    } finally {
      setSubmitting(false)
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
      <PageHeader
        title="Progress updates"
        description="Share updates whenever you make meaningful progress — not required every week."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Post an update</CardTitle>
          <CardDescription>Visible to your mentors.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-2">
              <Label htmlFor="summary">What did you work on?</Label>
              <Textarea
                id="summary"
                rows={3}
                placeholder="Shipped the login flow, tested with 5 users..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                disabled={!project}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="blockers">Any blockers? (optional)</Label>
              <Textarea
                id="blockers"
                rows={2}
                placeholder="Need help with..."
                value={blockers}
                onChange={(e) => setBlockers(e.target.value)}
                disabled={!project}
              />
            </div>
            {!project && (
              <p className="text-sm text-muted-foreground">
                You need a project before you can post updates —{' '}
                <Link to="/workspace" className="text-primary hover:underline">
                  start one in your Workspace
                </Link>
                .
              </p>
            )}
            {submitError && <p className="text-sm text-destructive">{submitError}</p>}
            <div>
              <Button type="submit" disabled={!project || submitting}>
                {submitting && <Loader2 className="size-4 animate-spin" />}
                Post update
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3">
        {updates.length === 0 && (
          <p className="text-sm text-muted-foreground">No updates yet — post your first one above.</p>
        )}
        {updates.map((update) => (
          <Card key={update.id}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {formatDate(update.created_at)}
                </span>
                <span className="text-xs text-muted-foreground">{timeAgo(update.created_at)}</span>
              </div>
              <p className="mt-2 text-sm">{update.summary}</p>
              {update.blockers && (
                <p className="mt-2 rounded-md bg-warning/10 px-3 py-2 text-sm text-warning">
                  Blocker: {update.blockers}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
