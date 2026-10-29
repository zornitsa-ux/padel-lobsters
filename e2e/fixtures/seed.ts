/* The synthetic world supabase/seed.sql creates. Specs read it and leave it as
   it was; anything a spec writes, it creates through fixtures/db.ts. */

export interface Account {
  id: string
  name: string
  email: string
  password: string
  pin: string
}

const player = (n: number) => `00000000-0000-4000-a000-0000000000${String(n).padStart(2, '0')}`

export const ADMIN: Account = {
  id: player(1),
  name: 'Mara Quint',
  email: 'admin@lobsters.test',
  password: 'Lobster-Admin-9999',
  pin: '9999',
}

export const PLAYER: Account = {
  id: player(10),
  name: 'Theo Lind',
  email: 'player@lobsters.test',
  password: 'Lobster-Player-1234',
  pin: '1234',
}

export const SEED_PLAYERS = {
  lena: { id: player(2), name: 'Lena Voss' },
  noor: { id: player(4), name: 'Noor Haddad' },
  kofi: { id: player(13), name: 'Kofi Mensah' },
}

/** Sign-in specs change these accounts' auth state, so they play in nothing. */
export const SIGN_IN_EMAILS = {
  code: 'code@lobsters.test',
  modal: 'modal@lobsters.test',
  password: 'password@lobsters.test',
  link: 'link@lobsters.test',
  reset: 'reset@lobsters.test',
  transferFrom: 'transfer-from@lobsters.test',
  transferTo: 'transfer-to@lobsters.test',
}

export const SEED_EVENTS = {
  social: { id: '00000000-0000-4000-b000-000000000101', name: 'Lobster Social' },
  opener: { id: '00000000-0000-4000-b000-000000000102', name: 'Season Opener' },
  pairs: { id: '00000000-0000-4000-b000-000000000103', name: 'Mixed Pairs Night' },
  kingOfCourt: { id: '00000000-0000-4000-b000-000000000104', name: 'King of the Court' },
}

export const SEED_LEAGUE = {
  id: '00000000-0000-4000-e000-000000000501',
  name: 'Autumn League',
  playerTeam: 'Net Rushers',
}

export const SEED_MERCH = ['Lobster Tee', 'Lobster Cap']
