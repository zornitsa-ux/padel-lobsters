/** Playtomic level bands (owner, 2026-11-04): a teal ramp, darker as the level rises. */
const LEVEL_BANDS = [
  { below: 2, className: 'bg-lob-line-strong text-lob-slate' },
  { below: 4, className: 'bg-lob-teal-light text-lob-teal' },
  { below: 5, className: 'ring-1 ring-inset ring-lob-teal text-lob-teal' },
  { below: Infinity, className: 'bg-lob-teal text-white' },
] as const

export function levelBadgeClass(level: number | null | undefined): string {
  const value = level ?? 0
  return (LEVEL_BANDS.find((band) => value < band.below) ?? LEVEL_BANDS[0]).className
}

// Per-player stats live in ../lib/playerStats so Dashboard.jsx and
// Players.jsx share a single source of truth — see imports above.

export interface LobbyPrompt {
  label: string
  placeholder: string
}

// Rotating fun prompts for the "notes" field shown at registration
export const LOBBY_PROMPTS: LobbyPrompt[] = [
  { label: '🎤 Trash Talk', placeholder: 'Say something to your future opponents…' },
  { label: '🦞 Lobster Confession', placeholder: 'Confess your deepest padel sin…' },
  { label: '💬 War Cry', placeholder: 'What do you scream before a match?' },
  { label: '🏅 Bold Claim', placeholder: 'Make a promise you may not keep…' },
  { label: '🎯 Battle Cry', placeholder: 'Inspire (or scare) your opponents…' },
  { label: '😤 Excuse Generator', placeholder: 'Pre-write your excuse for losing today…' },
  { label: '🤝 Personal Pledge', placeholder: 'What do you bring to the court?' },
  { label: '👀 Scouting Report', placeholder: 'Describe your playing style in one line…' },
]
export const randomPrompt = (): LobbyPrompt =>
  LOBBY_PROMPTS[Math.floor(Math.random() * LOBBY_PROMPTS.length)]

// Shape of the add/edit player form state. `playtomicLevel` stays a string
// while the number input is being typed and is parsed at submit-time.
export interface PlayerFormState {
  firstName: string
  lastName: string
  name: string
  email: string
  phone: string
  playtomicLevel: string | number
  playtomicUsername: string
  notes: string
  gender: string
  isLeftHanded: boolean
  country: string
  avatarUrl: string
  birthday: string
  preferredPosition: string
}

export const emptyForm: PlayerFormState = {
  // New registrations split First / Last into separate inputs. The combined
  // value gets written back into `name` at submit-time so the DB schema
  // stays unchanged. Existing players get their `name` split on edit
  // (first word → firstName, rest → lastName); admins can manually tidy
  // legacy one-word names if they want.
  firstName: '',
  lastName: '',
  name: '',
  email: '',
  phone: '',
  playtomicLevel: '',
  playtomicUsername: '',
  notes: '',
  gender: '',
  isLeftHanded: false,
  country: '',
  avatarUrl: '',
  birthday: '',
  preferredPosition: '',
}

// Country data and picker imported from ./CountryPicker
