// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import CountryPicker, { FlagImg } from './CountryPicker'
import { propsOf } from '../../test/element'

afterEach(cleanup)

const searchBox = () => screen.getByRole('textbox') as HTMLInputElement

describe('FlagImg', () => {
  it('renders nothing without a two-letter code', () => {
    expect(FlagImg({ code: undefined })).toBeNull()
    expect(FlagImg({ code: '' })).toBeNull()
    expect(FlagImg({ code: 'NLD' })).toBeNull()
  })

  it('builds a lowercase flagcdn URL', () => {
    const el = FlagImg({ code: 'NL' })
    expect(propsOf(el).src).toBe('https://flagcdn.com/20x15/nl.png')
    expect(propsOf(el).alt).toBe('NL')
  })
})

describe('CountryPicker', () => {
  it('shows the selected country label when closed', () => {
    render(<CountryPicker value="NL" onChange={vi.fn()} />)
    expect(searchBox().value).toBe('Netherlands')
  })

  it('filters by label and by country code', () => {
    render(<CountryPicker value="" onChange={vi.fn()} />)
    fireEvent.change(searchBox(), { target: { value: 'nether' } })
    expect(screen.getByRole('button', { name: /netherlands/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^Spain$/i })).toBeNull()

    fireEvent.change(searchBox(), { target: { value: 'ES' } })
    expect(screen.getByRole('button', { name: /spain/i })).toBeTruthy()
  })

  it('reports the empty state when nothing matches', () => {
    render(<CountryPicker value="" onChange={vi.fn()} />)
    fireEvent.change(searchBox(), { target: { value: 'zzzz' } })
    expect(screen.getByText('No countries found')).toBeTruthy()
  })

  it('never offers the placeholder row as a choice', () => {
    render(<CountryPicker value="" onChange={vi.fn()} />)
    fireEvent.focus(searchBox())
    expect(screen.queryByRole('button', { name: /select country/i })).toBeNull()
  })

  it('commits a pick on mousedown and closes the list', () => {
    const onChange = vi.fn()
    render(<CountryPicker value="" onChange={onChange} />)
    fireEvent.change(searchBox(), { target: { value: 'nether' } })
    fireEvent.mouseDown(screen.getByRole('button', { name: /netherlands/i }))
    expect(onChange).toHaveBeenCalledWith('NL')
    expect(screen.queryByRole('button', { name: /netherlands/i })).toBeNull()
  })

  it('closes and clears the query on an outside click', () => {
    render(<CountryPicker value="" onChange={vi.fn()} />)
    fireEvent.change(searchBox(), { target: { value: 'nether' } })
    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('button', { name: /netherlands/i })).toBeNull()
    // Closed with no selection, the field falls back to the placeholder row's
    // label as its displayed value.
    expect(searchBox().value).toBe('Select country…')
  })
})
