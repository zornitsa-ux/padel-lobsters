import { describe, expect, it } from 'vitest'
import { normalisePlayers } from '../../lib/normalise'
import { playerPublicRowSchema } from './playerSchemas'
import { mergeMyProfile, isSelectablePlayer } from './playerSelectors'

// fetchPlayers does: validate rows with Zod, then run them through
// normalisePlayers. We exercise that exact pipeline here without touching the
// network, since it's the contract the rest of the app reads against.
const runPipeline = (rows: unknown[]) => normalisePlayers(playerPublicRowSchema.array().parse(rows))

describe('players_public validate → normalise pipeline', () => {
  it('produces the camelCase fields downstream code reads', () => {
    const [player] = runPipeline([
      {
        id: 'p1',
        name: 'Ada',
        status: 'active',
        playtomic_level: 4.7,
        is_left_handed: true,
        avatar_url: 'https://example.com/a.png',
        preferred_position: 'right',
        tagline_label: 'war cry',
      },
    ])

    expect(player).toMatchObject({
      id: 'p1',
      name: 'Ada',
      status: 'active',
      playtomicLevel: 4.7,
      isLeftHanded: true,
      avatarUrl: 'https://example.com/a.png',
      preferredPosition: 'right',
      taglineLabel: 'war cry',
    })
  })

  it('coerces numeric strings from the view', () => {
    const [player] = runPipeline([{ id: 'p2', name: 'Bo', playtomic_level: '3.5' }])
    expect(player.playtomicLevel).toBe(3.5)
  })

  it('tolerates null columns and applies defaults', () => {
    const [player] = runPipeline([
      { id: 'p3', name: 'Cy', status: null, avatar_url: null, is_left_handed: null },
    ])
    expect(player).toMatchObject({
      status: 'active',
      avatarUrl: '',
      isLeftHanded: false,
      playtomicLevel: 0,
    })
  })

  it('passes unknown/future columns through untouched', () => {
    const [player] = runPipeline([{ id: 'p4', name: 'Di', some_new_column: 'keep me' }])
    expect(player).toMatchObject({ some_new_column: 'keep me' })
  })

  it('rejects a row missing the id (fails loudly at the boundary)', () => {
    expect(() => runPipeline([{ name: 'no id' }])).toThrow()
  })
})

describe('mergeMyProfile', () => {
  const [base] = normalisePlayers([{ id: 'me', name: 'Me', playtomic_level: 4 }])
  // get_my_profile_v2 returns SETOF players, so the PII row is a full row —
  // not a sparse overlay.
  const [pii] = normalisePlayers([
    { id: 'me', name: 'Me', playtomic_level: 4, email: 'me@example.com', phone: '+31600000000' },
  ])

  it('returns null when neither source is present (signed out)', () => {
    expect(mergeMyProfile(null, null)).toBeNull()
    expect(mergeMyProfile(undefined, undefined)).toBeNull()
  })

  it('returns roster identity alone when there is no PII row', () => {
    const result = mergeMyProfile(base, null)
    expect(result).toMatchObject({ id: 'me', name: 'Me', playtomicLevel: 4 })
    expect(result?.email).toBeUndefined()
  })

  it('overlays PII on top of roster identity', () => {
    const result = mergeMyProfile(base, pii)
    expect(result).toMatchObject({
      id: 'me',
      name: 'Me',
      playtomicLevel: 4,
      email: 'me@example.com',
      phone: '+31600000000',
    })
  })
})

describe('isSelectablePlayer', () => {
  // Deleting a player is a soft delete, so the roster query keeps returning
  // them — the filter is what stops a deleted player showing up as a choice.
  it('excludes deleted players', () => {
    expect(isSelectablePlayer({ status: 'deleted' })).toBe(false)
  })

  it('keeps everyone else, including rows with no status at all', () => {
    for (const status of ['active', 'pending', 'placeholder', undefined, null]) {
      expect(isSelectablePlayer({ status })).toBe(true)
    }
  })
})
