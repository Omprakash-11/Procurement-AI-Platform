'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { EvaluationView } from '@/lib/evaluation'
import { fetchJson } from '@/lib/fetch-json'
import type { CriteriaRequest, CriterionInput, NoteRequest, OverrideRequest, TemplateRequest } from '@/lib/schemas/evaluation'
import type { ScoringTemplate } from '@/lib/scoring-templates'
import type { VendorDocumentsResponse, VendorNote } from '@/lib/vendor-detail'

// Tech Stack §11.1: processing is async — the client polls every 5 s while anything is running.
const POLL_MS = 5_000

const documentsKey = (rfpId: string, entryId: string) => ['vendor-documents', rfpId, entryId] as const
const evaluationKey = (rfpId: string) => ['evaluation', rfpId] as const
const notesKey = (entryId: string) => ['vendor-notes', entryId] as const
const templatesKey = ['scoring-templates'] as const

export function useVendorDocuments(rfpId: string, entryId: string, initialData: VendorDocumentsResponse) {
  return useQuery({
    queryKey: documentsKey(rfpId, entryId),
    queryFn: () => fetchJson<VendorDocumentsResponse>(`/api/rfps/${rfpId}/vendors/${entryId}/documents`),
    initialData,
    refetchInterval: (query) => (query.state.data?.documents.some((d) => d.status === 'queued' || d.status === 'processing') ? POLL_MS : false),
  })
}

export function useRetryDocument(rfpId: string, entryId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (documentId: string) => fetchJson(`/api/process/document/${documentId}`, { method: 'POST' }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: documentsKey(rfpId, entryId) }),
  })
}

export function useFlagAction(rfpId: string, entryId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ flagId, action }: { flagId: string; action: 'acknowledge' | 'escalate' }) =>
      fetchJson(`/api/compliance-flags/${flagId}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: documentsKey(rfpId, entryId) }),
  })
}

export function useNotes(rfpId: string, entryId: string, initialData: VendorNote[]) {
  return useQuery({
    queryKey: notesKey(entryId),
    queryFn: async () => (await fetchJson<{ notes: VendorNote[] }>(`/api/rfps/${rfpId}/vendors/${entryId}/notes`)).notes,
    initialData,
  })
}

export function useAddNote(rfpId: string, entryId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: NoteRequest) => fetchJson(`/api/rfps/${rfpId}/vendors/${entryId}/notes`, { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKey(entryId) }),
  })
}

export function useEvaluation(rfpId: string, initialData: EvaluationView) {
  return useQuery({
    queryKey: evaluationKey(rfpId),
    queryFn: async () => (await fetchJson<{ evaluation: EvaluationView }>(`/api/evaluations/${rfpId}`)).evaluation,
    initialData,
    refetchInterval: (query) => (query.state.data?.status === 'scoring_in_progress' ? POLL_MS : false),
  })
}

export function useOverrideScore(rfpId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ scoreId, ...body }: OverrideRequest & { scoreId: string }) =>
      fetchJson(`/api/scores/${scoreId}/override`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: evaluationKey(rfpId) }),
  })
}

export function useStartScoring(rfpId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ evaluationId, vendorAccountId }: { evaluationId: string; vendorAccountId?: string }) =>
      fetchJson<{ run: number }>(`/api/process/score/${evaluationId}`, { method: 'POST', body: JSON.stringify(vendorAccountId ? { vendorAccountId } : {}) }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: evaluationKey(rfpId) }),
  })
}

export function useSuggestCriteria(rfpId: string) {
  return useMutation({
    mutationFn: async () => (await fetchJson<{ criteria: CriterionInput[] }>(`/api/process/suggest-criteria/${rfpId}`, { method: 'POST' })).criteria,
  })
}

export function useSaveCriteria(rfpId: string) {
  return useMutation({
    mutationFn: (body: CriteriaRequest) => fetchJson<{ evaluationId: string }>(`/api/evaluations/${rfpId}/criteria`, { method: 'PUT', body: JSON.stringify(body) }),
  })
}

export function useGenerateReport() {
  return useMutation({
    mutationFn: (evaluationId: string) => fetchJson<{ rfpId: string }>(`/api/process/report/${evaluationId}`, { method: 'POST' }),
  })
}

export function useShareLink(rfpId: string) {
  return useMutation({
    mutationFn: () => fetchJson<{ url: string; expiresAt: string }>(`/api/reports/${rfpId}/share`, { method: 'POST' }),
  })
}

export function useTemplates(enabled = true) {
  return useQuery({
    queryKey: templatesKey,
    queryFn: async () => (await fetchJson<{ templates: ScoringTemplate[] }>('/api/scoring-templates')).templates,
    enabled,
  })
}

export function useSaveTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: TemplateRequest & { id?: string }) =>
      fetchJson<{ id: string }>(id ? `/api/scoring-templates/${id}` : '/api/scoring-templates', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesKey }),
  })
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => fetchJson(`/api/scoring-templates/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: templatesKey }),
  })
}
