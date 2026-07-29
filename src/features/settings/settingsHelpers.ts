// The two admin-editable settings fields, held as form state in Settings and
// rendered by AdminSection.
export interface SettingsForm {
  whatsappLink: string
  groupName: string
}

// In-place edit of one padel tip: which row, and its draft text.
export interface EditingTip {
  index: number
  text: string
}

// The profile edit form. Every field is a string because it is bound straight
// to an <input>; playtomicLevel is parsed on save.
export interface ProfileForm {
  name: string
  country: string
  gender: string
  isLeftHanded: boolean
  preferredPosition: string
  playtomicLevel: string
  tagline: string
  email: string
  phone: string
  birthday: string
  avatarUrl: string
}

export interface LobbyPrompt {
  label: string
  placeholder: string
}

export const LOBBY_PROMPTS: LobbyPrompt[] = [
  { label: '🎤 Trash Talk', placeholder: 'Say something to your future opponents…' },
  { label: '🦞 Confession', placeholder: 'Confess your deepest padel sin…' },
  { label: '💬 War Cry', placeholder: 'What do you scream before a match?' },
  { label: '🏅 Bold Claim', placeholder: 'Make a promise you may not keep…' },
  { label: '🎯 Battle Cry', placeholder: 'Inspire (or scare) your opponents…' },
  { label: '😤 Excuse', placeholder: 'Pre-write your excuse for losing today…' },
  { label: '🤝 Pledge', placeholder: 'What do you bring to the court?' },
  { label: '👀 Scouting', placeholder: 'Describe your playing style in one line…' },
]
