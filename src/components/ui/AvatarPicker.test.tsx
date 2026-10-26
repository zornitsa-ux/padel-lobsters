// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AvatarPicker } from './AvatarPicker'

afterEach(cleanup)

describe('AvatarPicker', () => {
  it('offers to add a photo when there is none', () => {
    render(<AvatarPicker preview={null} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Add photo' })).toBeTruthy()
    expect(screen.getByText('Tap camera icon to add photo')).toBeTruthy()
  })

  it('offers to change the photo when one is shown', () => {
    render(<AvatarPicker preview="blob:photo" onChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeTruthy()
    expect(screen.getByAltText('Preview').getAttribute('src')).toBe('blob:photo')
  })

  it('opens the file picker from the camera button and reports the choice', () => {
    const onChange = vi.fn()
    const { container } = render(<AvatarPicker preview={null} onChange={onChange} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const click = vi.spyOn(input, 'click')

    fireEvent.click(screen.getByRole('button', { name: 'Add photo' }))
    expect(click).toHaveBeenCalled()

    fireEvent.change(input, { target: { files: [new File(['x'], 'me.png')] } })
    expect(onChange).toHaveBeenCalled()
  })
})
