import type { SupabaseClient } from '@supabase/supabase-js'
import type { ReadOutcome } from './parity-normalize.ts'

export interface ReadContext {
  client: SupabaseClient
  userId: string
  tournamentId: string
}

export interface Read {
  name: string
  run: (context: ReadContext) => PromiseLike<ReadOutcome>
}

const PAGE_SIZE = 1000

// PostgREST caps a response at max_rows (1000), so large tables are read in ordered pages.
async function readTable({
  client,
  table,
  orderBy,
}: {
  client: SupabaseClient
  table: string
  orderBy: string
}): Promise<ReadOutcome> {
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select('*')
      .order(orderBy)
      .range(from, from + PAGE_SIZE - 1)
    if (error) return { data: null, error }
    rows.push(...data)
    if (data.length < PAGE_SIZE) return { data: rows, error: null }
  }
}

const table = ({ name, orderBy = 'id' }: { name: string; orderBy?: string }): Read => ({
  name: `table:${name}`,
  run: ({ client }) => readTable({ client, table: name, orderBy }),
})

const rpc = ({
  name,
  args,
}: {
  name: string
  args?: (context: ReadContext) => Record<string, unknown>
}): Read => ({
  name: `rpc:${name}`,
  run: (context) => context.client.rpc(name, args?.(context)),
})

const tournamentArg = ({ tournamentId }: ReadContext) => ({ input_tournament_id: tournamentId })

// One line per read. Changing this list invalidates comparisons with earlier records.
export const READS: Read[] = [
  // The player's own profile and scoped PII
  rpc({ name: 'get_my_profile_v2' }),
  table({ name: 'players' }),
  table({ name: 'players_public' }),
  table({ name: 'player_aliases', orderBy: 'historical_name' }),
  // Registrations and transfers
  table({ name: 'registrations' }),
  table({ name: 'registration_transfers' }),
  table({ name: 'registration_status_events' }),
  table({ name: 'public_tournament_registration_counts', orderBy: 'tournament_id' }),
  // Tournaments, matches and ratings
  table({ name: 'tournaments' }),
  table({ name: 'matches' }),
  table({ name: 'rating_events' }),
  rpc({ name: 'admin_get_mm_ratings' }),
  // Leagues
  table({ name: 'leagues' }),
  table({ name: 'league_teams' }),
  table({ name: 'league_matches' }),
  table({ name: 'league_interests' }),
  // Raffle
  table({ name: 'raffle_winners' }),
  table({ name: 'raffle_exclusions', orderBy: 'tournament_id' }),
  rpc({ name: 'admin_get_raffle_exclusions', args: tournamentArg }),
  rpc({ name: 'admin_get_raffle_ineligible', args: tournamentArg }),
  // Merch and settings
  table({ name: 'merch_items' }),
  table({ name: 'merch_interests' }),
  table({ name: 'settings' }),
  // Lobster Oscars
  table({ name: 'lobster_oscars_sessions' }),
  table({ name: 'lobster_oscars_categories' }),
  table({ name: 'lobster_oscars_votes' }),
  rpc({ name: 'lobster_oscars_get_my_votes', args: tournamentArg }),
  rpc({ name: 'lobster_oscars_get_results', args: tournamentArg }),
  // Admin-only security and scheduling data
  table({ name: 'pin_attempts' }),
  table({ name: 'schedule_runs' }),
  rpc({ name: 'admin_list_security_events', args: () => ({ input_limit: 100000 }) }),
]
