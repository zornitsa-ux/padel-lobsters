import { supabase } from '../../supabase'

/** A name already on the roster: a placeholder awaiting an invite, or a member. */
export interface NameMatch {
  kind: 'placeholder' | 'member'
  name: string
}

/**
 * Asks the database whether a typed name is taken, without loading the roster
 * (signed-out visitors can't read it). Returns null for no match.
 */
export async function fetchSignupNameMatch({ name }: { name: string }): Promise<NameMatch | null> {
  const { data, error } = await supabase.rpc('signup_name_match', { input_name: name })
  if (error) throw error
  return data === 'placeholder' || data === 'member' ? { kind: data, name } : null
}
