import { createAdminClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

export type TeamMemberStatus = 'active' | 'pending' | 'deactivated'
export type TeamMember = { id: string; fullName: string; email: string; role: UserRole; status: TeamMemberStatus }

/**
 * Members of an org for Settings → Team (decision P4-8). Emails live in auth.users, so this
 * reads with the service role — call it only after checking the caller is that org's PM.
 */
export async function listTeamMembers(orgId: string): Promise<TeamMember[]> {
  const admin = createAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, full_name, role, is_active, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: true })

  return Promise.all(
    (profiles ?? []).map(async (p) => {
      const { data } = await admin.auth.admin.getUserById(p.id)
      const user = data.user
      const pending = Boolean(user && (!user.email_confirmed_at || (user.app_metadata as { team_invite_hash?: string }).team_invite_hash))
      return {
        id: p.id,
        fullName: p.full_name,
        email: user?.email ?? '',
        role: p.role,
        status: !p.is_active ? 'deactivated' : pending ? 'pending' : 'active',
      } satisfies TeamMember
    })
  )
}
