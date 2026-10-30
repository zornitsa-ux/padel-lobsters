import React from 'react'
import { Link } from 'react-router-dom'

type AnchorAttributes = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'className' | 'children' | 'href'
>
type ButtonAttributes = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'className' | 'children'
>

/**
 * `to` is in-app navigation (router Link). `href` is a plain anchor; `external` opens it in
 * a new tab. A disabled link renders as a disabled button, so it can't navigate.
 */
export type ActionProps =
  | (AnchorAttributes & { to: string; href?: never; external?: never; disabled?: boolean })
  | (AnchorAttributes & { href: string; external?: boolean; to?: never; disabled?: boolean })
  | (ButtonAttributes & { to?: never; href?: never; external?: never })

const NEW_TAB = { target: '_blank', rel: 'noopener noreferrer' }

const buttonAttributes = (attributes: AnchorAttributes | ButtonAttributes) => {
  const {
    target: _target,
    rel: _rel,
    download: _download,
    hrefLang: _hrefLang,
    media: _media,
    ping: _ping,
    referrerPolicy: _referrerPolicy,
    ...shared
  } = attributes as AnchorAttributes
  return shared as ButtonAttributes
}

/** Shared by `Button`, `TextButton` and `IconButton`: picks the element, they pick the look. */
export function renderAction({
  props,
  className,
  children,
}: {
  props: ActionProps
  className: string
  children: React.ReactNode
}) {
  const { to, href, external, disabled, ...rest } = props

  if (to !== undefined && !disabled) {
    return (
      <Link to={to} {...(rest as AnchorAttributes)} className={className}>
        {children}
      </Link>
    )
  }
  if (href !== undefined && !disabled) {
    return (
      <a
        href={href}
        {...(external ? NEW_TAB : {})}
        {...(rest as AnchorAttributes)}
        className={className}
      >
        {children}
      </a>
    )
  }
  const { type = 'button', ...button } = buttonAttributes(rest)
  return (
    <button type={type} disabled={disabled} {...button} className={className}>
      {children}
    </button>
  )
}

/** A whole surface that navigates with `to`, or runs `onClick` for an in-page action such as opening a modal. */
export type LinkOrAction = { to: string; onClick?: never } | { onClick: () => void; to?: never }

export const linkOrActionProps = ({
  to,
  onClick,
}: {
  to?: string
  onClick?: () => void
}): ActionProps => (to !== undefined ? { to } : { onClick })
