// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import PlayerForm from './PlayerForm'
import { emptyForm } from './playerConstants'

const noop = () => {}

const renderForm = () =>
  render(
    <PlayerForm
      showForm
      editId={null}
      isAdmin
      form={{ ...emptyForm, firstName: 'Ada', lastName: 'Lovelace', playtomicLevel: '3.5' }}
      setForm={noop}
      avatarPreview={null}
      fileInputRef={{ current: null }}
      handleAvatarChange={noop}
      handleSubmit={noop}
      saving={false}
      mergePlayer={null}
      setMergePlayer={noop}
      acceptMerge={noop}
      lobbyPrompt={{ label: '💬 War Cry', placeholder: 'Shout something' }}
      onClose={noop}
    />,
  )

afterEach(cleanup)

describe('PlayerForm — admin add/edit (D-028)', () => {
  it('collects a Playtomic level and no personal adjustment', () => {
    renderForm()

    expect(screen.getByText('Playtomic Level (0–7)')).toBeTruthy()
    expect(screen.queryByText(/personal adjustment/i)).toBeNull()
    expect(screen.queryByText(/adjusted level/i)).toBeNull()
    expect(screen.queryByText(/positive = stronger/i)).toBeNull()
  })

  it('has no adjustment key in the shared form default', () => {
    expect(emptyForm).not.toHaveProperty('adjustment')
    expect(emptyForm).toHaveProperty('playtomicLevel')
  })
})
