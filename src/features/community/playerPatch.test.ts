import { describe, expect, it } from 'vitest'
import { buildPlayerEditPatch } from './playerPatch'
import { emptyForm } from './playerConstants'
import type { CommunityPlayer } from './playersSelectors'

const source: CommunityPlayer = {
  id: 'p1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  phone: '+31612345678',
  playtomicLevel: 3.5,
  playtomicUsername: 'ada',
  gender: 'female',
  isLeftHanded: false,
  country: 'NL',
  avatarUrl: 'https://cdn.test/ada.webp',
  birthday: '1990-01-01',
  preferredPosition: 'right',
  notes: 'trash talk',
  status: 'active',
}

// Reconstructs the form the way Players.tsx does — seeded straight from
// `source`, so an untouched save round-trips to an empty patch.
const formFromSource = () => ({
  ...emptyForm,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: source.email!,
  phone: source.phone!,
  playtomicLevel: String(source.playtomicLevel),
  playtomicUsername: source.playtomicUsername!,
  gender: source.gender!,
  isLeftHanded: source.isLeftHanded!,
  country: source.country!,
  avatarUrl: source.avatarUrl!,
  birthday: source.birthday!,
  preferredPosition: source.preferredPosition!,
  notes: source.notes!,
})

describe('buildPlayerEditPatch', () => {
  it('produces an empty patch when nothing changed', () => {
    const form = formFromSource()
    const patch = buildPlayerEditPatch({
      form,
      avatarUrl: source.avatarUrl!,
      combinedName: source.name!,
      notesPromptLabel: '🎤 Trash Talk',
      source,
    })
    expect(patch).toEqual({})
  })

  it('treats a form that disagrees with source as real edits, not noise', () => {
    // buildPlayerEditPatch's guarantee is narrower than "blank never wipes":
    // it only guarantees an UNTOUCHED field (form === source) is omitted.
    // A form seeded from a stale/blank record legitimately looks like the
    // admin cleared everything — that's why Players.tsx's formReady gate
    // (openEdit/acceptMerge awaiting resolveWithPii before the form opens)
    // is the thing that keeps `source` and the form's initial values in
    // sync in the first place; this diff only protects an already-correct
    // seed from unrelated-save overwrites, not a wrong seed.
    const blankForm = { ...emptyForm, firstName: 'Ada', lastName: 'Lovelace' }
    const patch = buildPlayerEditPatch({
      form: blankForm,
      avatarUrl: '',
      combinedName: source.name!,
      notesPromptLabel: '🎤 Trash Talk',
      source,
    })
    expect(patch.email).toBe('')
    expect(patch.phone).toBe('')
  })

  it('includes only the field that actually changed', () => {
    const form = { ...formFromSource(), phone: '+31600000000' }
    const patch = buildPlayerEditPatch({
      form,
      avatarUrl: source.avatarUrl!,
      combinedName: source.name!,
      notesPromptLabel: '🎤 Trash Talk',
      source,
    })
    expect(patch).toEqual({ phone: '+31600000000' })
  })

  it('emits an explicit clear + sentinel when the admin empties a field that had a value', () => {
    const form = { ...formFromSource(), email: '' }
    const patch = buildPlayerEditPatch({
      form,
      avatarUrl: source.avatarUrl!,
      combinedName: source.name!,
      notesPromptLabel: '🎤 Trash Talk',
      source,
    })
    // emailCleared tells admin_update_player this blank is deliberate — see
    // the guard migration, which otherwise leaves a blank email untouched.
    expect(patch).toEqual({ email: '', emailCleared: true })
  })

  it('only sends taglineLabel when notes actually changed', () => {
    const untouched = formFromSource()
    expect(
      buildPlayerEditPatch({
        form: untouched,
        avatarUrl: source.avatarUrl!,
        combinedName: source.name!,
        notesPromptLabel: '🦞 Lobster Confession', // a different random pick than what created `source`
        source,
      }),
    ).not.toHaveProperty('taglineLabel')

    const edited = { ...formFromSource(), notes: 'new trash talk' }
    const patch = buildPlayerEditPatch({
      form: edited,
      avatarUrl: source.avatarUrl!,
      combinedName: source.name!,
      notesPromptLabel: '🦞 Lobster Confession',
      source,
    })
    expect(patch.notes).toBe('new trash talk')
    expect(patch.taglineLabel).toBe('🦞 Lobster Confession')
  })

  it('never includes status — that is an explicit, separate action', () => {
    const form = { ...formFromSource(), phone: '+31600000000' }
    const patch = buildPlayerEditPatch({
      form,
      avatarUrl: source.avatarUrl!,
      combinedName: source.name!,
      notesPromptLabel: '🎤 Trash Talk',
      source,
    })
    expect(patch).not.toHaveProperty('status')
  })

  // Finding 4: resolving a merge banner onto a pending signup must still
  // activate the record — status transitions are otherwise explicit and
  // never a side effect of a plain field edit.
  describe('activate', () => {
    it('sets status: active when activate is true and the source is pending', () => {
      const pendingSource: CommunityPlayer = { ...source, status: 'pending' }
      const form = formFromSource()
      const patch = buildPlayerEditPatch({
        form,
        avatarUrl: source.avatarUrl!,
        combinedName: source.name!,
        notesPromptLabel: '🎤 Trash Talk',
        source: pendingSource,
        activate: true,
      })
      expect(patch).toEqual({ status: 'active' })
    })

    it('emits nothing when activate is true but the source is already active', () => {
      const form = formFromSource()
      const patch = buildPlayerEditPatch({
        form,
        avatarUrl: source.avatarUrl!,
        combinedName: source.name!,
        notesPromptLabel: '🎤 Trash Talk',
        source,
        activate: true,
      })
      expect(patch).toEqual({})
    })

    it('emits nothing when activate is not passed, even for a pending source', () => {
      const pendingSource: CommunityPlayer = { ...source, status: 'pending' }
      const form = formFromSource()
      const patch = buildPlayerEditPatch({
        form,
        avatarUrl: source.avatarUrl!,
        combinedName: source.name!,
        notesPromptLabel: '🎤 Trash Talk',
        source: pendingSource,
      })
      expect(patch).toEqual({})
    })
  })
})
