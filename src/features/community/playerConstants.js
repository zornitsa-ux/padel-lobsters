export const LEVEL_COLORS = [
  'bg-gray-200 text-gray-700',
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-teal-100 text-teal-700',
  'bg-yellow-100 text-yellow-700',
  'bg-orange-100 text-orange-700',
  'bg-red-100 text-red-700',
  'bg-purple-100 text-purple-700',
]

// Per-player stats live in ../lib/playerStats so Dashboard.jsx and
// Players.jsx share a single source of truth — see imports above.

// Rotating fun prompts for the "notes" field shown at registration
export const LOBBY_PROMPTS = [
  { label: '🎤 Trash Talk', placeholder: 'Say something to your future opponents…' },
  { label: '🦞 Lobster Confession', placeholder: 'Confess your deepest padel sin…' },
  { label: '💬 War Cry', placeholder: 'What do you scream before a match?' },
  { label: '🏅 Bold Claim', placeholder: 'Make a promise you may not keep…' },
  { label: '🎯 Battle Cry', placeholder: 'Inspire (or scare) your opponents…' },
  { label: '😤 Excuse Generator', placeholder: 'Pre-write your excuse for losing today…' },
  { label: '🤝 Personal Pledge', placeholder: 'What do you bring to the court?' },
  { label: '👀 Scouting Report', placeholder: 'Describe your playing style in one line…' },
]
export const randomPrompt = () => LOBBY_PROMPTS[Math.floor(Math.random() * LOBBY_PROMPTS.length)]

export const emptyForm = {
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
  adjustment: '0',
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
