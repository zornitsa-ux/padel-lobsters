import type { LevellingState } from './levellingFlow'

// Unfinished answers survive closing the flow for the rest of the session only
// (DESIGN §2.2): memory, not storage, and keyed by user so a shared device
// never hands one player's answers to the next.
const drafts = new Map<string, LevellingState>()

export function readDraft({ userId }: { userId: string }): LevellingState | undefined {
  return drafts.get(userId)
}

export function saveDraft({ userId, state }: { userId: string; state: LevellingState }): void {
  drafts.set(userId, state)
}

export function clearDraft({ userId }: { userId: string }): void {
  drafts.delete(userId)
}
