// Default description prefilled into every new event. Admins can edit
// it freely per event — this is just the starting text so common
// logistics (check-in time, what's included, pairing style) are always
// visible to players without someone having to retype them each time.
export const DEFAULT_EVENT_DESCRIPTION = `Please arrive 15 minutes early for a quick check-in, meet & greet, and rules briefing.
Includes courts, balls 🎾, food 🍗, a winner's prize, and raffle prizes 🏆
Pairings are arranged for fun, balanced games.`

export const emptyForm = {
  name: '',
  date: '',
  time: '',
  location: '',
  maxPlayers: '16',
  duration: 90,
  format: 'americano',
  genderMode: 'mixed',
  courtBookingMode: 'admin_all',
  courts: [{ name: '', booked: false, costPerPerson: '', responsible: '', tikkieLink: '' }],
  pricePerPerson: '',
  tikkieLink: '',
  notes: DEFAULT_EVENT_DESCRIPTION,
}
