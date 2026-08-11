import type { Tables } from './database.types'

// Rows reach the normalisers through a `.passthrough()` Zod parse and, on some
// paths, a partial `select()` list, so every generated column is widened to
// optional-and-nullable here. Column names and value types still come from the
// DB — this only expresses "may not have been selected", which is exactly the
// contract each normaliser's `?? default` chain is written against.
type LooseRow<T> = { [K in keyof T]?: T[K] | null }

// Raw player row as it arrives from the players_public view, the players table
// or the get_my_profile_v2 RPC (snake_case). Every column is optional because
// each of those three sources exposes a different subset; the shape itself
// comes from the generated `players` row so the DB stays the single source of
// truth. The camelCase aliases are accepted because normalisation is
// idempotent — already-normalised players are re-normalised in a few places.
export interface RawPlayerRow extends LooseRow<Tables<'players'>> {
  id: string
  playtomicLevel?: number | null
  playtomicUsername?: string | null
  isLeftHanded?: boolean | null
  avatarUrl?: string | null
  preferredPosition?: string | null
  taglineLabel?: string | null
}

// The normalised player shape consumed across the app: the raw row is spread
// through (so snake_case columns and any future columns remain accessible),
// with these camelCase aliases layered on top. PII fields are present only when
// the row came from get_my_profile_v2 (see useMyProfile).
export interface Player extends RawPlayerRow {
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

// A single court entry, stored (and edited) in camelCase inside the row's
// `courts` JSON column. The column itself is `jsonb`, so this shape is the
// app's contract with itself rather than something the DB enforces.
export type TournamentCourt = {
  name: string
  booked: boolean
}

// Raw `tournaments` row as it arrives from the fetch boundary (snake_case,
// Zod-validated). Columns are optional because partial selects are common;
// `courts` is re-typed off the generated `Json` to the shape the app writes.
export interface RawTournamentRow extends LooseRow<Omit<Tables<'tournaments'>, 'courts'>> {
  id: string
  courts?: TournamentCourt[] | null
  maxPlayers?: number | null
  totalPrice?: number | null
  tikkieLink?: string | null
  genderMode?: string | null
  completedAt?: string | null
  resultsSharedAt?: string | null
  rafflePublishedAt?: string | null
}

// The normalised tournament consumed across the app: the raw row spread through
// (snake_case + future columns stay accessible) with these camelCase aliases
// and defaults layered on top.
export interface NormalisedTournament extends RawTournamentRow {
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
  totalPrice: number
  tikkieLink: string
  genderMode: string
  completedAt: string | null
  // D-029: null while a completed tournament's final ranking is withheld from
  // players (admins always see it regardless). See resultsPhase().
  resultsSharedAt: string | null
  rafflePublishedAt: string | null
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
    totalPrice: t.total_price ?? t.totalPrice ?? 0,
    tikkieLink: t.tikkie_link ?? t.tikkieLink ?? '',
    genderMode: t.gender_mode ?? t.genderMode ?? 'mixed',
    completedAt: t.completed_at ?? t.completedAt ?? null,
    resultsSharedAt: t.results_shared_at ?? t.resultsSharedAt ?? null,
    rafflePublishedAt: t.raffle_published_at ?? t.rafflePublishedAt ?? null,
  }))
}

// Raw `registrations` row from the fetch boundary (Zod-validated). The
// camelCase variants are accepted because normalisation is idempotent —
// already-normalised rows are re-normalised in a few places.
export interface RawRegistrationRow extends LooseRow<Tables<'registrations'>> {
  id: string
  tournament_id: string
  player_id: string
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
export interface RawMatchRow extends LooseRow<Tables<'matches'>> {
  id: string
  tournament_id: string
  tournamentId?: string | null
  team1Ids?: string[] | null
  team2Ids?: string[] | null
  team1Level?: number | null
  team2Level?: number | null
  updatedAt?: string | null
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
    updatedAt: m.updated_at ?? m.updatedAt ?? null,
  }))
}

// Raw `registration_transfers` row from the fetch boundary (Zod-validated),
// plus the camelCase variants normalisation accepts.
export interface RawTransferRow extends LooseRow<Tables<'registration_transfers'>> {
  id: string
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
