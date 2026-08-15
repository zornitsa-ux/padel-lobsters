import { supabase } from '../supabase'
import { emitToast } from '../lib/toastBus'
import type { Database } from '../lib/database.types'

export type SecurityEventRow =
  Database['public']['Functions']['admin_list_security_events']['Returns'][number]

// Admin: recent security events feed (pin_attempts, joined to player names).
// Surfaces load failures as a toast — an admin reviewing security events
// needs to know the feed didn't load, not see an empty log.
export async function adminListSecurityEvents(limit = 100): Promise<SecurityEventRow[]> {
  try {
    const { data, error } = await supabase.rpc('admin_list_security_events', {
      input_limit: limit,
    })
    if (error) {
      console.error('admin_list_security_events error:', error)
      emitToast({ variant: 'error', message: 'Could not load recent security events.' })
      return []
    }
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('admin_list_security_events error:', error)
    emitToast({ variant: 'error', message: 'Could not load recent security events.' })
    return []
  }
}
