import styles from './Skeleton.module.css'

interface SkeletonProps {
  /** Sizing and shape utilities — height, width, rounding override, margins. */
  className?: string
}

// A single placeholder block. Give it the metrics of the content it stands in
// for so the real value lands without shifting the layout.
//
// Deliberately silent to assistive tech: the container that swaps skeletons for
// content owns the `role="status"` announcement, so a card full of these reads
// as one "loading" rather than a dozen.
export function Skeleton({ className = '' }: SkeletonProps) {
  return <div aria-hidden="true" className={`${styles.skeleton} ${className}`.trim()} />
}

export default Skeleton
