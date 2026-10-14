'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { fetchJson } from '@/lib/fetch-json'
import type { RFPRequest, RFPUpdate } from '@/lib/schemas/rfp'
import type { VendorInviteFormValues } from '@/lib/schemas/vendor-invite'
import type { RfpStatus } from '@/lib/status'
import type { Enums } from '@/types'

export type PipelineRfp = {
  id: string
  title: string
  department: string
  status: RfpStatus
  submission_deadline: string | null
  updated_at: string
  requirement_id: string | null
  vendor_count: number
}
export type PendingRequirement = {
  id: string
  title: string
  department: string
  required_by: string | null
  priority: Enums<'requirement_priority'>
  created_at: string
}
type PipelineResponse = { rfps: PipelineRfp[]; requirements: PendingRequirement[] }

export type PipelineFilters = { department?: string; status?: string; from?: string; to?: string }

const pipelineKey = (filters: PipelineFilters) => ['rfps', 'pipeline', filters] as const

export function usePipeline(filters: PipelineFilters) {
  const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][])
  return useQuery({
    queryKey: pipelineKey(filters),
    queryFn: () => fetchJson<PipelineResponse>(`/api/rfps?${params.toString()}`),
  })
}

export function useCreateRfp() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RFPRequest) => fetchJson<{ rfp: { id: string } }>('/api/rfps', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rfps'] }),
  })
}

export function useUpdateRfp(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: RFPUpdate) => fetchJson(`/api/rfps/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rfps'] }),
  })
}

// Kanban drop: optimistic update in the TanStack Query cache (CLAUDE.md: never Zustand for
// API data — overrides Tech Stack §8.2), rolled back if the server refuses.
export function useMoveRfp(filters: PipelineFilters) {
  const queryClient = useQueryClient()
  const key = pipelineKey(filters)
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RfpStatus }) =>
      fetchJson(`/api/rfps/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<PipelineResponse>(key)
      if (previous) {
        queryClient.setQueryData<PipelineResponse>(key, {
          ...previous,
          rfps: previous.rfps.map((r) => (r.id === id ? { ...r, status } : r)),
        })
      }
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['rfps'] }),
  })
}

export function useInviteVendor(rfpId: string) {
  return useMutation({
    mutationFn: (body: VendorInviteFormValues) =>
      fetchJson<{ entryId: string; email: string }>(`/api/rfps/${rfpId}/invite-vendor`, { method: 'POST', body: JSON.stringify(body) }),
  })
}

export function useVendorAction(rfpId: string) {
  return useMutation({
    mutationFn: ({ entryId, action }: { entryId: string; action: 'remove' | 'shortlist' | 'unshortlist' }) =>
      fetchJson<{ status: string }>(`/api/rfps/${rfpId}/vendors/${entryId}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  })
}
