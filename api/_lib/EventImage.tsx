import { formatLabel } from '../../src/features/events/eventHelpers'
import { coral, cream, teal, tealDark } from '../../brandColors.js'
import { SITE_NAME, formatPreviewDate, type PreviewEvent } from './eventPreview'

// Satori renders outside Tailwind, so the brand colours come from the module
// tailwind.config.js builds its lob-* tokens from.
const BRAND = { teal, tealDark, coral, cream, white: '#FFFFFF' }

// 1200×630 share card: who's hosting, what, when, where. No spot count.
export function EventImage({ event, logo }: { event: PreviewEvent | null; logo: string }) {
  const when = event ? formatPreviewDate(event) : ''
  const format = event?.format ? formatLabel(event.format) : ''
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        backgroundImage: `linear-gradient(135deg, ${BRAND.teal} 0%, ${BRAND.tealDark} 100%)`,
        color: BRAND.white,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <img src={logo} width={96} height={96} style={{ borderRadius: 48 }} />
        <div style={{ fontSize: 36, color: BRAND.cream }}>{SITE_NAME}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'block', fontSize: 76, lineHeight: 1.05, lineClamp: 2 }}>
          {event?.name || 'Upcoming events'}
        </div>
        {when && <div style={{ fontSize: 40, color: BRAND.cream }}>{when}</div>}
        {event?.location && (
          <div style={{ fontSize: 34, color: BRAND.cream, opacity: 0.85 }}>{event.location}</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {format ? (
          <div
            style={{
              display: 'flex',
              fontSize: 30,

              padding: '12px 28px',
              borderRadius: 999,
              backgroundColor: BRAND.coral,
            }}
          >
            {format}
          </div>
        ) : (
          <div style={{ display: 'flex' }} />
        )}
        <div style={{ fontSize: 30, color: BRAND.cream }}>padelobsters.nl</div>
      </div>
    </div>
  )
}
