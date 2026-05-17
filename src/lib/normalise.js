export function normalisePlayers(players) {
  return players.map((p) => ({
    ...p,
    playtomicLevel: p.playtomic_level ?? p.playtomicLevel ?? 0,
    adjustment: p.adjustment ?? 0,
    adjustedLevel: p.adjusted_level ?? p.adjustedLevel ?? 0,
    learnedLevel: p.learned_rating != null ? (Number(p.learned_rating) - 1200) / 100 : null,
    learnedRd: p.learned_rd != null ? Number(p.learned_rd) : null,
    learnedMatchesCount: p.learned_matches_count ?? 0,
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

export function normaliseTournaments(tournaments) {
  return tournaments.map((t) => ({
    ...t,
    maxPlayers: t.max_players ?? t.maxPlayers ?? 16,
    duration: t.duration ?? 90,
    courts: t.courts ?? [],
    location: t.location ?? '',
    courtBookingMode: t.court_booking_mode ?? t.courtBookingMode ?? 'admin_all',
    totalPrice: t.total_price ?? t.totalPrice ?? 0,
    tikkieLink: t.tikkie_link ?? t.tikkieLink ?? '',
    genderMode: t.gender_mode ?? t.genderMode ?? 'mixed',
    completedAt: t.completed_at ?? t.completedAt ?? null,
  }))
}

export function normaliseRegistrations(registrations) {
  return registrations.map((r) => ({
    ...r,
    tournamentId: r.tournament_id ?? r.tournamentId,
    playerId: r.player_id ?? r.playerId,
    paymentStatus: r.payment_status ?? r.paymentStatus ?? 'unpaid',
    paymentMethod: r.payment_method ?? r.paymentMethod ?? '',
    registeredAt: { seconds: r.created_at ? new Date(r.created_at).getTime() / 1000 : 0 },
  }))
}

export function normaliseMatches(matches) {
  return matches.map((m) => ({
    ...m,
    tournamentId: m.tournament_id ?? m.tournamentId,
    team1Ids: m.team1_ids ?? m.team1Ids ?? [],
    team2Ids: m.team2_ids ?? m.team2Ids ?? [],
    team1Level: m.team1_level ?? m.team1Level ?? 0,
    team2Level: m.team2_level ?? m.team2Level ?? 0,
  }))
}

export function normaliseTransfers(transfers) {
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
