import { z } from 'zod'
import { supabase } from '../../supabase'

export const authReadinessSchema = z.object({
  no_email: z.array(z.object({ id: z.string(), name: z.string() })),
  recent_pin_users: z.array(
    z.object({ id: z.string(), name: z.string(), last_pin_at: z.string() }),
  ),
  switched_count: z.number(),
  still_pin_count: z.number(),
})

export type AuthReadiness = z.infer<typeof authReadinessSchema>

export const authReadinessKey = ['admin', 'auth-readiness'] as const

export async function fetchAuthReadiness(): Promise<AuthReadiness> {
  const { data, error } = await supabase.rpc('admin_auth_readiness')
  if (error) throw error
  return authReadinessSchema.parse(data)
}
