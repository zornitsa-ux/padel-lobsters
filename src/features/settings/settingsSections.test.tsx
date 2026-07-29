// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, cleanup } from '@testing-library/react'
import { render } from '@testing-library/react'

// D-028: the Account page must expose neither the Matchmaking V2 rollout flag
// nor any Playtomic-adjustment field. AdminSecurityPanels is mocked because it
// owns its own RPCs and is unrelated to this change.
vi.mock('../../components/AdminSecurityPanels', () => ({
  default: () => <div data-testid="security-panels" />,
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

const profileSection = ({ expanded = true, prompt = false } = {}) => (
  <ProfileSection
    myPlayer={myPlayer}
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
    expect(screen.getByTestId('security-panels')).toBeTruthy()
    expect(screen.getByRole('button', { name: /save settings/i })).toBeTruthy()
  })
})

describe('ProfileSection — self-service profile', () => {
  it('offers a Playtomic level field and no adjustment field', () => {
    render(profileSection())

    expect(screen.getByText('Playtomic Level (0–7)')).toBeTruthy()
    // Exactly one numeric field remains in the level card.
    expect(document.querySelectorAll('input[type="number"]').length).toBe(1)
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
    // One number input in the prompt: the level itself.
    const numberInputs = document.querySelectorAll('input[type="number"]')
    expect(numberInputs.length).toBe(1)
  })
})
