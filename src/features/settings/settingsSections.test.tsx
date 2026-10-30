// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { render } from '@testing-library/react'

// D-028: the Account page must expose neither the Matchmaking V2 rollout flag
// nor any Playtomic-adjustment field. SecurityEventsPanel is mocked because it
// owns its own RPCs and is unrelated to this change.
vi.mock('../../components/SecurityEventsPanel', () => ({
  default: () => <div data-testid="security-events-panel" />,
}))
vi.mock('../../context/useApp', () => ({
  useApp: () => ({ requestMyEmailChange: vi.fn() }),
}))

import AdminSection from './AdminSection'
import ProfileSection from './ProfileSection'
import { normalisePlayers } from '../../lib/normalise'

const noop = () => {}

const adminSection = (
  <AdminSection
    form={{ groupName: 'Padel Lobsters', whatsappLink: '' }}
    setForm={noop}
    saving={false}
    saved={false}
    handleSave={noop}
    activeTips={['tip one']}
    isCustom={false}
    tipsExpanded={false}
    setTipsExpanded={noop}
    newTip=""
    setNewTip={noop}
    editingTip={null}
    setEditingTip={noop}
    handleAddTip={noop}
    handleDeleteTip={noop}
    handleEditTip={noop}
    handleSaveEdit={noop}
    handleResetTips={noop}
  />
)

// `adjustment` is deliberately still on the fixture: the assertions below check
// the UI never surfaces it, which only means something if the field is present.
const myPlayer = {
  ...normalisePlayers([{ id: 'p1', name: 'Ada Lovelace', playtomic_level: 3.5 }])[0],
  adjustment: 0.5,
}

const profileForm = {
  name: 'Ada Lovelace',
  country: 'NL',
  gender: 'female',
  isLeftHanded: false,
  preferredPosition: 'right',
  playtomicLevel: '3.5',
  tagline: '',
  email: 'ada@example.com',
  phone: '+31612345678',
  birthday: '',
  avatarUrl: '',
}

const profileSection = ({
  expanded = true,
  prompt = false,
  hasPii = true,
  profileLoadFailed = false,
} = {}) => (
  <ProfileSection
    myPlayer={myPlayer}
    hasPii={hasPii}
    profileLoadFailed={profileLoadFailed}
    profileExpanded={expanded}
    setProfileExpanded={noop}
    profileForm={profileForm}
    setProfileForm={noop}
    profileSaving={false}
    profileSaved={false}
    profileError=""
    avatarPreview={null}
    handleAvatarChange={noop}
    handleProfileSave={noop}
    activePrompt={2}
    setActivePrompt={noop}
    showPlaytomicPrompt={prompt}
    dismissPlaytomicPrompt={noop}
  />
)

afterEach(cleanup)

describe('AdminSection', () => {
  it('has no Matchmaking V2 rollout toggle', () => {
    render(adminSection)

    expect(screen.queryByText(/matchmaking/i)).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
  })

  it('has no Glicko-2 recompute control', () => {
    render(adminSection)

    expect(screen.queryByRole('button', { name: /recompute/i })).toBeNull()
    expect(screen.queryByText(/lobster score/i)).toBeNull()
    expect(screen.queryByText(/glicko/i)).toBeNull()
  })

  it('still renders the settings it owns', () => {
    render(adminSection)

    expect(screen.getByText('Group Info')).toBeTruthy()
    expect(screen.getByText('Padel Tips')).toBeTruthy()
    expect(screen.getByTestId('security-events-panel')).toBeTruthy()
    expect(screen.getByRole('button', { name: /save settings/i })).toBeTruthy()
  })
})

describe('ProfileSection — self-service profile', () => {
  it('offers a Playtomic level field and no adjustment field', () => {
    render(profileSection())

    // One level field, a decimal keypad so "3,5" can be typed.
    expect(screen.getByLabelText('Playtomic Level (0–7)').getAttribute('inputmode')).toBe('decimal')
    expect(document.querySelectorAll('input[inputmode="decimal"]').length).toBe(1)
    expect(screen.queryByText(/personal adjustment/i)).toBeNull()
    expect(screen.queryByText(/adjusted level/i)).toBeNull()
    expect(screen.queryByText(/positive = stronger/i)).toBeNull()
  })

  it('summarises the level as the Playtomic level alone', () => {
    render(profileSection({ expanded: false }))

    expect(screen.getByText(/playtomic level:/i)).toBeTruthy()
    expect(screen.getByText('3.5')).toBeTruthy()
    // The old summary rendered "(Playtomic 3.5 +0.5)".
    expect(screen.queryByText(/\+0\.5/)).toBeNull()
  })

  it('asks only for a new Playtomic level in the 30-day refresh prompt', () => {
    render(profileSection({ expanded: false, prompt: true }))

    expect(screen.getByText(/has your playtomic score changed/i)).toBeTruthy()
    expect(screen.getByText(/new playtomic level/i)).toBeTruthy()
    expect(screen.queryByText(/adjustment/i)).toBeNull()
    // One input in the prompt, the level itself, with a decimal keypad so "3,5" can be typed.
    expect(document.querySelectorAll('input[inputmode="decimal"]').length).toBe(1)
  })

  // Finding 2: a failed/unresolved profile RPC must not leave the Save
  // button stuck on the misleading "Loading your profile…" label forever.
  it('surfaces an explicit error and label when the profile failed to load', () => {
    render(profileSection({ hasPii: false, profileLoadFailed: true }))

    expect(
      screen.getByText(/couldn't load your profile details\. check your connection and reload\./i),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: /profile unavailable/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /loading your profile/i })).toBeNull()
  })

  it('still shows the loading label while the profile is merely in flight', () => {
    render(profileSection({ hasPii: false, profileLoadFailed: false }))

    expect(screen.getByRole('button', { name: /loading your profile/i })).toBeTruthy()
    expect(screen.queryByText(/couldn't load your profile details/i)).toBeNull()
  })
})
