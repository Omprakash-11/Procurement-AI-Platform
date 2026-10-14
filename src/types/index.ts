export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from './database'

import type { Enums } from './database'

export type UserRole = Enums<'user_role'>
export type UserType = 'internal' | 'vendor'

/** Custom claims injected into JWT app_metadata by custom_access_token_hook (Backend Schema §4.2). */
export interface AppClaims {
  user_type?: UserType
  role?: UserRole | 'vendor'
  org_id?: string
}
