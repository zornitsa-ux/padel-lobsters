// A court row while it is being edited in the event form. Numeric fields accept
// strings because they come straight off `<input>` values; they are coerced on
// submit (Tournament.jsx) before reaching `TournamentCourt`.
export interface EventFormCourt {
  name: string
  booked: boolean
}

// Draft state behind EventFormModal: `emptyForm` for a new event, or hydrated
// from a NormalisedTournament when editing — hence the string-or-number fields.
export interface EventFormValues {
  name: string
  date: string
  time: string
  location: string
  maxPlayers: string | number
  duration: string | number
  format: string
  genderMode: string
  courts: EventFormCourt[]
  pricePerPerson: string | number
  tikkieLink: string
  notes: string
}

// Default description prefilled into every new event. Admins can edit
// it freely per event — this is just the starting text so common
// logistics (check-in time, what's included, pairing style) are always
// visible to players without someone having to retype them each time.
export const DEFAULT_EVENT_DESCRIPTION = `Please arrive 15 minutes early for a quick check-in, meet & greet, and rules briefing.
Includes courts, balls 🎾, food 🍗, a winner's prize, and raffle prizes 🏆
Pairings are arranged for fun, balanced games.`

export const emptyForm: EventFormValues = {
  name: '',
  date: '',
  time: '',
  location: '',
  maxPlayers: '16',
  duration: 90,
  format: 'lobster_matching',
  genderMode: 'mixed',
  courts: [{ name: '', booked: false }],
  pricePerPerson: '',
  tikkieLink: '',
  notes: DEFAULT_EVENT_DESCRIPTION,
}
