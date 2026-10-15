'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow } from 'date-fns'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { FormField, fieldA11y } from '@/components/forms/form-field'
import { SubmitButton } from '@/components/forms/submit-button'
import { Textarea } from '@/components/ui/textarea'
import { ApiError, fetchJson } from '@/lib/fetch-json'
import type { ReportComment } from '@/lib/report-comments'
import { reportCommentSchema, type ReportCommentRequest } from '@/lib/schemas/requirement'

type ReportCommentsProps = { rfpId: string; initialComments: ReportComment[]; canComment: boolean }

// Decision P8-3 / App Flow §5: the Department Head's recommendation comments on the comparison
// report — free text, add-only. Shown to PM, the DH and the Finance Approver.
export function ReportComments({ rfpId, initialComments, canComment }: ReportCommentsProps) {
  const queryClient = useQueryClient()
  const key = ['report-comments', rfpId]
  const { data: comments } = useQuery({
    queryKey: key,
    queryFn: async () => (await fetchJson<{ comments: ReportComment[] }>(`/api/reports/${rfpId}/comments`)).comments,
    initialData: initialComments,
  })
  const form = useForm<ReportCommentRequest>({ resolver: zodResolver(reportCommentSchema), defaultValues: { body: '' } })
  const { errors, isSubmitting } = form.formState

  const submit = form.handleSubmit(async (values) => {
    try {
      await fetchJson(`/api/reports/${rfpId}/comments`, { method: 'POST', body: JSON.stringify(values) })
      form.reset({ body: '' })
      await queryClient.invalidateQueries({ queryKey: key })
      toast.success('Recommendation added', { duration: 4000 })
    } catch (err) {
      const field = err instanceof ApiError ? err.body.fields?.body?.[0] : undefined
      form.setError('body', { message: field ?? (err instanceof Error ? err.message : 'We could not save the comment.') })
    }
  })

  if (!canComment && comments.length === 0) return null

  return (
    <section aria-labelledby="dh-recommendations" className="space-y-4">
      <h2 id="dh-recommendations" className="text-xl font-semibold text-foreground">
        Department recommendations
      </h2>
      {canComment && (
        <form method="post" onSubmit={submit} noValidate className="max-w-3xl space-y-3">
          <FormField id="report-comment" label="Add your recommendation" error={errors.body?.message} hint="Visible to the procurement manager and the finance approver. Comments can't be edited.">
            <Textarea className="min-h-[96px] resize-y rounded" {...fieldA11y('report-comment', errors.body?.message)} {...form.register('body')} />
          </FormField>
          <div className="flex justify-end">
            <SubmitButton pending={isSubmitting} pendingLabel="Adding recommendation">
              Add Recommendation
            </SubmitButton>
          </div>
        </form>
      )}
      <ol className="max-w-3xl space-y-3" aria-label="Department recommendations">
        {comments.map((c) => (
          <li key={c.id} className="rounded border border-border bg-card p-4 shadow-sm">
            <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{c.authorName}</span>
              <time dateTime={c.createdAt} title={format(new Date(c.createdAt), 'd MMM yyyy, HH:mm')}>
                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
              </time>
            </div>
            <p className="whitespace-pre-line text-sm text-foreground">{c.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
