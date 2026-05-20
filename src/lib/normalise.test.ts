import { describe, expect, it } from 'vitest'
import {
  normalisePlayers,
  normaliseTournaments,
  normaliseRegistrations,
  normaliseMatches,
  normaliseTransfers,
} from './normalise'

describe('normalisePlayers', () => {
  it('maps snake_case fields and applies defaults', () => {
    const result = normalisePlayers([
      {
        id: 'p1',
        playtomic_level: 4.7,
        adjusted_level: 4.5,
        learned_rating: '1300',
        learned_rd: '35',
        learned_matches_count: 12,
        playtomic_username: 'lobster_ace',
        is_left_handed: true,
        avatar_url: 'https://example.com/avatar.png',
        preferred_position: 'right',
      },
      {
        id: 'p2',
      },
    ])

    expect(result).toEqual([
      {
        id: 'p1',
        playtomic_level: 4.7,
        adjusted_level: 4.5,
        learned_rating: '1300',
        learned_rd: '35',
        learned_matches_count: 12,
        playtomic_username: 'lobster_ace',
        is_left_handed: true,
        avatar_url: 'https://example.com/avatar.png',
        preferred_position: 'right',
        playtomicLevel: 4.7,
        adjustment: 0,
        adjustedLevel: 4.5,
        learnedLevel: 1,
        learnedRd: 35,
        learnedMatchesCount: 12,
        playtomicUsername: 'lobster_ace',
        gender: '',
        status: 'active',
        isLeftHanded: true,
        avatarUrl: 'https://example.com/avatar.png',
        country: '',
        preferredPosition: 'right',
        taglineLabel: '',
      },
      {
        id: 'p2',
        playtomicLevel: 0,
        adjustment: 0,
        adjustedLevel: 0,
        learnedLevel: null,
        learnedRd: null,
        learnedMatchesCount: 0,
        playtomicUsername: '',
        gender: '',
        status: 'active',
        isLeftHanded: false,
        avatarUrl: '',
        country: '',
        preferredPosition: '',
        taglineLabel: '',
      },
    ])
  })

  it('uses camelCase fields when snake_case is absent', () => {
    const [result] = normalisePlayers([
      {
        id: 'p3',
        playtomicLevel: 3.8,
        adjustedLevel: 4,
        learned_rating: 1400,
        learned_rd: 42,
        playtomicUsername: 'camel_case',
        isLeftHanded: true,
        avatarUrl: 'https://example.com/p3.png',
        preferredPosition: 'left',
        taglineLabel: 'all in',
      },
    ])

    expect(result).toMatchObject({
      id: 'p3',
      playtomicLevel: 3.8,
      adjustedLevel: 4,
      learnedLevel: 2,
      learnedRd: 42,
      playtomicUsername: 'camel_case',
      isLeftHanded: true,
      avatarUrl: 'https://example.com/p3.png',
      preferredPosition: 'left',
      taglineLabel: 'all in',
    })
  })
})

describe('normaliseTournaments', () => {
  it('maps fields and applies tournament defaults', () => {
    const result = normaliseTournaments([
      {
        id: 't1',
        max_players: 12,
        total_price: 96,
        tikkie_link: 'https://pay.example/1',
        gender_mode: 'women',
        completed_at: '2026-05-17T12:00:00Z',
      },
      { id: 't2' },
    ])

    expect(result[0]).toMatchObject({
      id: 't1',
      maxPlayers: 12,
      duration: 90,
      courts: [],
      location: '',
      courtBookingMode: 'admin_all',
      totalPrice: 96,
      tikkieLink: 'https://pay.example/1',
      genderMode: 'women',
      completedAt: '2026-05-17T12:00:00Z',
    })
    expect(result[1]).toMatchObject({
      id: 't2',
      maxPlayers: 16,
      duration: 90,
      courts: [],
      location: '',
      courtBookingMode: 'admin_all',
      totalPrice: 0,
      tikkieLink: '',
      genderMode: 'mixed',
      completedAt: null,
    })
  })
})

describe('normaliseRegistrations', () => {
  it('maps ids and builds registeredAt timestamp object', () => {
    const createdAt = '2026-01-01T10:30:00Z'
    const result = normaliseRegistrations([
      {
        id: 'r1',
        tournament_id: 't1',
        player_id: 'p1',
        payment_status: 'pending_confirmation',
        payment_method: 'bank_transfer',
        created_at: createdAt,
      },
      { id: 'r2', tournamentId: 't2', playerId: 'p2' },
    ])

    expect(result[0]).toMatchObject({
      id: 'r1',
      tournamentId: 't1',
      playerId: 'p1',
      paymentStatus: 'pending_confirmation',
      paymentMethod: 'bank_transfer',
      registeredAt: { seconds: new Date(createdAt).getTime() / 1000 },
    })
    expect(result[1]).toMatchObject({
      id: 'r2',
      tournamentId: 't2',
      playerId: 'p2',
      paymentStatus: 'unpaid',
      paymentMethod: '',
      registeredAt: { seconds: 0 },
    })
  })
})

describe('normaliseMatches', () => {
  it('normalises team and tournament fields with defaults', () => {
    const result = normaliseMatches([
      {
        id: 'm1',
        tournament_id: 't1',
        team1_ids: ['p1', 'p2'],
        team2_ids: ['p3', 'p4'],
        team1_level: 8.5,
        team2_level: 8.3,
      },
      { id: 'm2', tournamentId: 't2' },
    ])

    expect(result[0]).toMatchObject({
      id: 'm1',
      tournamentId: 't1',
      team1Ids: ['p1', 'p2'],
      team2Ids: ['p3', 'p4'],
      team1Level: 8.5,
      team2Level: 8.3,
    })
    expect(result[1]).toMatchObject({
      id: 'm2',
      tournamentId: 't2',
      team1Ids: [],
      team2Ids: [],
      team1Level: 0,
      team2Level: 0,
    })
  })
})

describe('normaliseTransfers', () => {
  it('maps transfer ids and date/reason metadata fields', () => {
    const [result] = normaliseTransfers([
      {
        id: 'tr1',
        tournament_id: 't1',
        from_player_id: 'p1',
        to_player_id: 'p2',
        closed_reason: 'accepted',
        responded_at: '2026-05-16T18:00:00Z',
        closed_at: '2026-05-16T18:02:00Z',
        created_at: '2026-05-16T17:50:00Z',
      },
    ])

    expect(result).toMatchObject({
      id: 'tr1',
      tournamentId: 't1',
      fromPlayerId: 'p1',
      toPlayerId: 'p2',
      closedReason: 'accepted',
      respondedAt: '2026-05-16T18:00:00Z',
      closedAt: '2026-05-16T18:02:00Z',
      createdAt: '2026-05-16T17:50:00Z',
    })
  })

  it('falls back to null for optional transfer metadata', () => {
    const [result] = normaliseTransfers([
      {
        id: 'tr2',
        tournamentId: 't2',
        fromPlayerId: 'p7',
        toPlayerId: 'p8',
      },
    ])

    expect(result).toMatchObject({
      id: 'tr2',
      tournamentId: 't2',
      fromPlayerId: 'p7',
      toPlayerId: 'p8',
      closedReason: null,
      respondedAt: null,
      closedAt: null,
      createdAt: null,
    })
  })
})
