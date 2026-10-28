import React from 'react'
import { renderAction, type ActionProps } from './action'

/** `row` sets the content in a centred row with a 12px gap; `block` leaves it to the children. */
type Layout = 'block' | 'row'

interface CardLinkContentProps {
  children: React.ReactNode
  layout?: Layout
  /** No padding, and content clipped to the rounded edge, for a card with a full-bleed band. */
  flush?: boolean
  /** A state look from the caller, such as dimmed or ringed. */
  className?: string
}

type CardLinkProps = CardLinkContentProps & ActionProps

const LAYOUT: Record<Layout, string> = {
  block: 'block',
  row: 'flex items-center gap-3',
}

const SHELL = {
  padded: 'card',
  flush: 'bg-white rounded-2xl overflow-hidden shadow-card border border-lob-dark/[0.06]',
}

/**
 * A whole card that is one link (`to`, `href`) or one action (`onClick`). For the standard
 * title / subtitle / chevron card use `LinkCard`, which is built on this.
 */
export function CardLink({
  children,
  layout = 'block',
  flush = false,
  className,
  ...props
}: CardLinkProps) {
  return renderAction({
    props,
    className: [
      flush ? SHELL.flush : SHELL.padded,
      LAYOUT[layout],
      'w-full text-left active:scale-[0.99] transition-transform',
      className,
    ]
      .filter(Boolean)
      .join(' '),
    children,
  })
}
