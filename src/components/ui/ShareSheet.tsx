import { useEffect, useState } from 'react'
import { Copy, Link2, Share2 } from 'lucide-react'
import { Modal } from './Modal'
import { OptionRow } from './OptionRow'
import { copyToClipboard } from '../../lib/whatsapp'

interface ShareSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** A line above the message saying why to share now, e.g. right after creating the event. */
  lead?: string
  /** The full message, link included. */
  message: string
  url: string
}

type Target = 'native' | 'message' | 'link'
type Outcome = { target: Target; ok: boolean } | null

const canShareNatively = () => typeof navigator !== 'undefined' && 'share' in navigator

/**
 * A bottom sheet for sharing a message and link: the phone's own share sheet (where the browser
 * has one), or a copy of the message or the link. Shows the message as it will be sent.
 * No direct WhatsApp (`wa.me`) option: it mangled emoji and was clunkier than WhatsApp picked
 * from the phone's share sheet (owner, 7 Nov).
 */
export function ShareSheet({ open, onClose, title, lead, message, url }: ShareSheetProps) {
  const [outcome, setOutcome] = useState<Outcome>(null)

  useEffect(() => {
    if (!open) setOutcome(null)
  }, [open])

  const subtitle = ({
    target,
    ok,
    fail,
    idle,
  }: {
    target: Target
    ok: string
    fail: string
    idle: string
  }) => (outcome?.target !== target ? idle : outcome.ok ? ok : fail)

  const copy = async (target: 'message' | 'link') => {
    const ok = await copyToClipboard(target === 'message' ? message : url)
    setOutcome({ target, ok })
  }

  // The link stays in the text rather than in `url`: WhatsApp on iOS appends `url` to the text,
  // which would print it twice.
  const shareNatively = async () => {
    try {
      await navigator.share({ title, text: message })
      onClose()
    } catch (err) {
      // Dismissing the phone's sheet is not a failure; the sheet stays open for another option.
      if (err instanceof DOMException && err.name === 'AbortError') return
      console.warn('navigator.share failed:', err)
      setOutcome({ target: 'native', ok: false })
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        {lead && <p className="text-sm text-lob-slate">{lead}</p>}
        <p
          data-testid="share-message"
          className="rounded-xl bg-lob-well px-4 py-3 text-sm text-lob-dark whitespace-pre-line break-words"
        >
          {message}
        </p>
        <div className="space-y-1">
          {canShareNatively() && (
            <OptionRow
              title="Share via…"
              subtitle={subtitle({
                target: 'native',
                ok: '',
                fail: "Couldn't open. Copy the message instead.",
                idle: 'WhatsApp, Messages, Instagram and more',
              })}
              leading={<Share2 size={18} />}
              onClick={shareNatively}
            />
          )}
          <OptionRow
            title="Copy message"
            subtitle={subtitle({
              target: 'message',
              ok: 'Copied',
              fail: "Couldn't copy. Select the text above instead.",
              idle: 'Text and link, ready to paste',
            })}
            leading={<Copy size={18} />}
            onClick={() => copy('message')}
          />
          <OptionRow
            title="Copy link"
            subtitle={subtitle({
              target: 'link',
              ok: 'Copied',
              fail: "Couldn't copy the link.",
              idle: 'Just the event link',
            })}
            leading={<Link2 size={18} />}
            onClick={() => copy('link')}
          />
        </div>
      </div>
    </Modal>
  )
}
