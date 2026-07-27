// Raw player row as it arrives from the players_public view or the
// get_my_profile_v2 RPC (snake_case). Loosely typed because callers validate
// with Zod at the fetch boundary before normalising.
export interface RawPlayerRow {
  id: string
  [key: string]: any
}

// The normalised player shape consumed across the app: the raw row is spread
// through (so snake_case columns and any future columns remain accessible),
// with these camelCase aliases layered on top. PII fields are present only when
// the row came from get_my_profile_v2 (see useMyProfile).
export interface Player {
  id: string
  name: string
  playtomicLevel: number
  playtomicUsername: string
  gender: string
  status: string
  isLeftHanded: boolean
  avatarUrl: string
  country: string
  preferredPosition: string
  taglineLabel: string
  email?: string | null
  phone?: string | null
  birthday?: string | null
  [key: string]: any
}

export function normalisePlayers(players: RawPlayerRow[]): Player[] {
  return players.map((p) => ({
    ...p,
    name: p.name ?? '',
    playtomicLevel: p.playtomic_level ?? p.playtomicLevel ?? 0,
    playtomicUsername: p.playtomic_username ?? p.playtomicUsername ?? '',
    gender: p.gender ?? '',
    status: p.status ?? 'active',
    isLeftHanded: p.is_left_handed ?? p.isLeftHanded ?? false,
    avatarUrl: p.avatar_url ?? p.avatarUrl ?? '',
    country: p.country ?? '',
    preferredPosition: p.preferred_position ?? p.preferredPosition ?? '',
    taglineLabel: p.tagline_label ?? p.taglineLabel ?? '',
  }))
}

// Raw `tournaments` row as it arrives from the fetch boundary (snake_case,
// Zod-validated). Loosely typed with an index signature because callers spread
// unlisted passthrough columns straight through normalisation.
export interface RawTournamentRow {
  id: string
  [key: string]: any
}

// A single court entry, stored (and edited) in camelCase inside the row's
// `courts` JSON column.
export interface TournamentCourt {
  name: string
  booked: boolean
  costPerPerson: number | string
  responsible: string
  tikkieLink: string
}

// The normalised tournament consumed across the app: the raw row spread through
// (snake_case + future columns stay accessible via the index signature) with
// these camelCase aliases and defaults layered on top.
export interface NormalisedTournament {
  id: string
  name: string
  date: string
  time: string
  location: string
  status: string
  format: string
  notes: string
  maxPlayers: number
  duration: number
  courts: TournamentCourt[]
  courtBookingMode: string
  totalPrice: number
  tikkieLink: string
  genderMode: string
  completedAt: string | null
  // D-029: null while a completed tournament's final ranking is withheld from
  // players (admins always see it regardless). See resultsPhase().
  resultsSharedAt: string | null
  [key: string]: any
}

export function normaliseTournaments(tournaments: RawTournamentRow[]): NormalisedTournament[] {
  return tournaments.map((t) => ({
    ...t,
    name: t.name ?? '',
    date: t.date ?? '',
    time: t.time ?? '',
    status: t.status ?? '',
    format: t.format ?? '',
    notes: t.notes ?? '',
    maxPlayers: t.max_players ?? t.maxPlayers ?? 16,
    duration: t.duration ?? 90,
    courts: t.courts ?? [],
    location: t.location ?? '',
    courtBookingMode: t.court_booking_mode ?? t.courtBookingMode ?? 'admin_all',
    totalPrice: t.total_price ?? t.totalPrice ?? 0,
    tikkieLink: t.tikkie_link ?? t.tikkieLink ?? '',
    genderMode: t.gender_mode ?? t.genderMode ?? 'mixed',
    completedAt: t.completed_at ?? t.completedAt ?? null,
    resultsSharedAt: t.results_shared_at ?? t.resultsSharedAt ?? null,
  }))
}

// Raw `registrations` row from the fetch boundary (Zod-validated). The
// camelCase variants are accepted because normalisation is idempotent —
// already-normalised rows are re-normalised in a few places.
export interface RawRegistrationRow {
  id: string
  tournament_id: string
  player_id: string
  status: string
  payment_status?: string | null
  payment_method?: string | null
  created_at?: string | null
  tournamentId?: string | null
  playerId?: string | null
  paymentStatus?: string | null
  paymentMethod?: string | null
}

export interface NormalisedRegistration extends RawRegistrationRow {
  tournamentId: string
  playerId: string
  paymentStatus: string
  paymentMethod: string
  // Legacy Firestore-shaped timestamp kept for the consumers that sort on it.
  registeredAt: { seconds: number }
}

export function normaliseRegistrations(
  registrations: RawRegistrationRow[],
): NormalisedRegistration[] {
  return registrations.map((r) => ({
    ...r,
    tournamentId: r.tournament_id ?? r.tournamentId,
    playerId: r.player_id ?? r.playerId,
    paymentStatus: r.payment_status ?? r.paymentStatus ?? 'unpaid',
    paymentMethod: r.payment_method ?? r.paymentMethod ?? '',
    registeredAt: { seconds: r.created_at ? new Date(r.created_at).getTime() / 1000 : 0 },
  }))
}

// Raw `matches` row from the fetch boundary (Zod-validated), plus the camelCase
// variants normalisation accepts.
export interface RawMatchRow {
  id: string
  tournament_id: string
  round: number
  court?: string | null
  team1_ids?: string[] | null
  team2_ids?: string[] | null
  team1_level?: number | null
  team2_level?: number | null
  score1?: number | null
  score2?: number | null
  completed: boolean
  created_at?: string | null
  tournamentId?: string | null
  team1Ids?: string[] | null
  team2Ids?: string[] | null
  team1Level?: number | null
  team2Level?: number | null
}

export interface NormalisedMatch extends RawMatchRow {
  tournamentId: string
  team1Ids: string[]
  team2Ids: string[]
  team1Level: number
  team2Level: number
}

export function normaliseMatches(matches: RawMatchRow[]): NormalisedMatch[] {
  return matches.map((m) => ({
    ...m,
    tournamentId: m.tournament_id ?? m.tournamentId,
    team1Ids: m.team1_ids ?? m.team1Ids ?? [],
    team2Ids: m.team2_ids ?? m.team2Ids ?? [],
    team1Level: m.team1_level ?? m.team1Level ?? 0,
    team2Level: m.team2_level ?? m.team2Level ?? 0,
  }))
}

// Raw `registration_transfers` row from the fetch boundary (Zod-validated),
// plus the camelCase variants normalisation accepts.
export interface RawTransferRow {
  id: string
  tournament_id?: string | null
  from_player_id?: string | null
  to_player_id?: string | null
  status?: string | null
  closed_reason?: string | null
  responded_at?: string | null
  closed_at?: string | null
  created_at?: string | null
  tournamentId?: string | null
  fromPlayerId?: string | null
  toPlayerId?: string | null
  closedReason?: string | null
  respondedAt?: string | null
  closedAt?: string | null
  createdAt?: string | null
}

export interface NormalisedTransfer extends RawTransferRow {
  tournamentId?: string | null
  fromPlayerId?: string | null
  toPlayerId?: string | null
  closedReason: string | null
  respondedAt: string | null
  closedAt: string | null
  createdAt: string | null
}

export function normaliseTransfers(transfers: RawTransferRow[]): NormalisedTransfer[] {
  return transfers.map((t) => ({
    ...t,
    tournamentId: t.tournament_id ?? t.tournamentId,
    fromPlayerId: t.from_player_id ?? t.fromPlayerId,
    toPlayerId: t.to_player_id ?? t.toPlayerId,
    closedReason: t.closed_reason ?? t.closedReason ?? null,
    respondedAt: t.responded_at ?? t.respondedAt ?? null,
    closedAt: t.closed_at ?? t.closedAt ?? null,
    createdAt: t.created_at ?? t.createdAt ?? null,
  }))
}
