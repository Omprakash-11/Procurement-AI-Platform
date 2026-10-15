import { NextResponse } from 'next/server'

import { apiError, requireUser } from '@/lib/api'
import { loadContracts, type ContractSort, type ContractStatus } from '@/lib/contracts'
import { Constants } from '@/types/database'

const SORTS: ContractSort[] = ['end_date', 'value', 'vendor']

// GET /api/contracts — Backend Schema §8.7: list with status filter and sort. PM and FA (FA read
// via RLS contracts_fa_read; FA has no Contracts page — P9 defaults, #22).
export async function GET(request: Request) {
  const auth = await requireUser(['procurement_manager', 'finance_approver'])
  if (!auth.ok) return auth.response
  const params = new URL(request.url).searchParams
  const status = params.get('status')
  const sort = params.get('sort')
  if (status && !Constants.public.Enums.contract_status.includes(status as ContractStatus)) return apiError(400, 'validation_error', 'Unknown status filter.')
  if (sort && !SORTS.includes(sort as ContractSort)) return apiError(400, 'validation_error', 'Unknown sort.')
  const contracts = await loadContracts(auth.supabase, {
    ...(status ? { status: status as ContractStatus } : {}),
    ...(sort ? { sort: sort as ContractSort } : {}),
  })
  return NextResponse.json({ contracts })
}
