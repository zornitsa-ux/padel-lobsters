import React from 'react'
import styles from './ActionChip.module.css'

// ============================================================================
//  ActionChip
//
//  The tertiary action shape: a small, label-width chip for utilities that sit
//  under content rather than lead it (Share, Add to calendar). Renders as an
//  <a> when given an href — iOS Safari blocks window.open from a button as a
//  popup — and as a <button> otherwise, mirroring IconButton.
//
//  Deliberately takes no size or colour props. A tertiary action that needs to
//  stand out is not a chip; reach for .btn-secondary instead.
// ============================================================================

interface ActionChipProps {
  children: React.ReactNode
  /** Icon element, sized by the caller to match the label. */
  icon?: React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) => void
  /** When set the chip renders as an anchor instead of a button. */
  href?: string
  target?: string
  rel?: string
  /** The unabbreviated action, since chip labels are shortened. */
  title?: string
  'aria-label'?: string
  className?: string
}

export function ActionChip({
  children,
  icon,
  onClick,
  href,
  target,
  rel,
  title,
  className,
  ...rest
}: ActionChipProps) {
  const classes = `${styles.chip} ${className ?? ''}`.trim()

  if (href) {
    return (
      <a
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        title={title}
        className={classes}
        {...rest}
      >
        {icon}
        {children}
      </a>
    )
  }

  return (
    <button type="button" onClick={onClick} title={title} className={classes} {...rest}>
      {icon}
      {children}
    </button>
  )
}
