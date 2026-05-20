import { supabase } from '../supabase'

// Upload an already-processed avatar image (webp blob from processAvatar)
// to the 'avatars' bucket. The filename pattern differs between callers:
//   - Settings (profile drawer) uses a stable 'player-{id}.webp' so the
//     same player keeps overwriting the same file (with a cache-buster
//     query string applied client-side after).
//   - Admin Players form and SignupRequest use a fresh random filename
//     per upload so concurrent edits don't clobber each other.
//
// Pass `stable: true` and the playerId to use the stable pattern; omit
// or pass `stable: false` for the random-name behaviour.
export async function uploadAvatar(processed, { playerId, stable = false } = {}) {
  const filename = stable
    ? `player-${playerId}.webp`
    : `player-${Date.now()}-${Math.random().toString(36).slice(2)}.webp`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filename, processed, { upsert: true, contentType: 'image/webp' })
  if (uploadError) throw uploadError
  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(filename)
  return publicUrl
}
