import type { PlayerFormState } from './playerConstants'
import type { CommunityPlayer } from './playersSelectors'
import type { PlayerInput } from '../players/playerQueries'

const normText = (v: string | number | null | undefined): string => String(v ?? '').trim()

interface BuildEditPatchArgs {
  form: PlayerFormState
  avatarUrl: string
  combinedName: string
  /** The prompt category to attach to `notes` — only sent if `notes` changed. */
  notesPromptLabel: string
  /** The exact record that seeded the form (post-PII-resolve). */
  source: CommunityPlayer
  /**
   * True only when this save resolves a merge banner onto a pending signup.
   * That's an intentional admin approval, unlike a plain field edit, so it's
   * the one edit path allowed to also flip status to active.
   */
  activate?: boolean
}

// Diffs the submitted form against the exact record that seeded it and
// includes a field in the patch only when it actually changed. admin_update_
// player treats "key present, blank" as "clear this column" — so an
// untouched field must never appear in the payload, whether it's blank
// because the admin left it alone or because it hadn't loaded yet when the
// form opened. Structural fix for the 2026-08-15 email-wipe incident: as
// long as `source` is the real pre-edit record (guaranteed by resolving PII
// before the form opens — see openEdit/acceptMerge/handleLinkConfirm in
// Players.tsx), a field that was never touched is byte-identical to itself
// and gets omitted, so it cannot be mistaken for an intentional clear.
export function buildPlayerEditPatch({
  form,
  avatarUrl,
  combinedName,
  notesPromptLabel,
  source,
  activate,
}: BuildEditPatchArgs): PlayerInput {
  const patch: PlayerInput = {}
  const parsedLevel = parseFloat(String(form.playtomicLevel)) || 0

  if (activate && source.status === 'pending') patch.status = 'active'

  if (normText(combinedName) !== normText(source.name)) patch.name = combinedName
  if (normText(form.email) !== normText(source.email)) {
    patch.email = normText(form.email)
    // admin_update_player refuses to NULL a non-empty email unless this
    // sentinel says the admin meant it — see the guard migration. Only set
    // it on a genuine clear (had a value, now blank); a same-blank-to-blank
    // "change" can't happen here since it wouldn't have triggered this branch.
    if (patch.email === '' && normText(source.email) !== '') patch.emailCleared = true
  }
  if (normText(form.phone) !== normText(source.phone)) patch.phone = normText(form.phone)
  if (parsedLevel !== (source.playtomicLevel ?? 0)) patch.playtomicLevel = parsedLevel
  if (normText(form.playtomicUsername) !== normText(source.playtomicUsername)) {
    patch.playtomicUsername = normText(form.playtomicUsername)
  }
  if (normText(form.gender) !== normText(source.gender)) patch.gender = normText(form.gender)
  if (!!form.isLeftHanded !== !!source.isLeftHanded) patch.isLeftHanded = !!form.isLeftHanded
  if (normText(form.country) !== normText(source.country)) patch.country = normText(form.country)
  if (normText(avatarUrl) !== normText(source.avatarUrl)) patch.avatarUrl = normText(avatarUrl)
  if (normText(form.birthday) !== normText(source.birthday)) patch.birthday = form.birthday || null
  if (normText(form.preferredPosition) !== normText(source.preferredPosition)) {
    patch.preferredPosition = normText(form.preferredPosition)
  }
  if (normText(form.notes) !== normText(source.notes)) {
    patch.notes = normText(form.notes)
    // taglineLabel only follows a genuine notes edit — it's the category the
    // note was written under, not something to reshuffle on every unrelated
    // save (Players.tsx picks a random prompt label on every mount).
    patch.taglineLabel = notesPromptLabel
  }

  return patch
}
