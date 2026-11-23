import { describe, it, expect } from 'vitest'
import { LOBBY_PROMPTS, refreshPromptText } from './settingsHelpers'

// The prompt list is indexed by `activePrompt` and its label is persisted to
// players.tagline_label, so both the ordering and the labels are load-bearing:
// a saved label is looked up by findIndex on every profile load.
describe('LOBBY_PROMPTS', () => {
  it('has a non-empty label and placeholder for every prompt', () => {
    expect(LOBBY_PROMPTS.length).toBeGreaterThan(0)
    for (const prompt of LOBBY_PROMPTS) {
      expect(prompt.label.trim()).not.toBe('')
      expect(prompt.placeholder.trim()).not.toBe('')
    }
  })

  it('has unique labels so a saved tagline_label resolves to one index', () => {
    const labels = LOBBY_PROMPTS.map((p) => p.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps "War Cry" at index 2 — the default selection in Settings', () => {
    expect(LOBBY_PROMPTS[2].label).toContain('War Cry')
  })
})

describe('refreshPromptText', () => {
  it('names the level on file, or says there is none', () => {
    expect(refreshPromptText({ level: 2.5 })).toMatch(/on file is 2\.5\.$/)
    expect(refreshPromptText({ level: 2.45 })).toMatch(/on file is 2\.45\.$/)
    expect(refreshPromptText({ level: 0 })).toMatch(/haven't added a Playtomic level/)
  })
})
