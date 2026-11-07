import { useEffect, useState } from 'react'
import { Copy, Link2, MessageCircle, Share2 } from 'lucide-react'
import { Modal } from './Modal'
import { OptionRow } from './OptionRow'
import { copyToClipboard } from '../../lib/whatsapp'

interface ShareSheetProps {
  open: boolean
  onClose: () => void
  title: string
  /** The full message, link included. */
  message: string
  url: string
}

type Copied = 'message' | 'link' | null

const canShareNatively = () => typeof navigator !== 'undefined' && 'share' in navigator

const whatsAppUrl = (message: string) => `https://wa.me/?text=${encodeURIComponent(message)}`

/**
 * A bottom sheet for sharing a message and link: the phone's own share sheet (where the browser
 * has one), WhatsApp, or a copy of the message or the link. Shows the message as it will be sent.
 */
export function ShareSheet({ open, onClose, title, message, url }: ShareSheetProps) {
  const [copied, setCopied] = useState<Copied>(null)

  useEffect(() => {
    if (!open) setCopied(null)
  }, [open])

  const copy = async (what: Exclude<Copied, null>) => {
    const ok = await copyToClipboard(what === 'message' ? message : url)
    setCopied(ok ? what : null)
  }

  const shareNatively = async () => {
    try {
      await navigator.share({ title, text: message })
      onClose()
    } catch {
      // Dismissed, or the target refused: the sheet stays open for another option.
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
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
              subtitle="Messages, Instagram, Telegram and more"
              leading={<Share2 size={18} />}
              onClick={shareNatively}
            />
          )}
          <OptionRow
            title="WhatsApp"
            subtitle="Send to a chat or group"
            leading={<MessageCircle size={18} />}
            href={whatsAppUrl(message)}
            external
            onClick={onClose}
          />
          <OptionRow
            title="Copy message"
            subtitle={copied === 'message' ? 'Copied' : 'Text and link, ready to paste'}
            leading={<Copy size={18} />}
            onClick={() => copy('message')}
          />
          <OptionRow
            title="Copy link"
            subtitle={copied === 'link' ? 'Copied' : url}
            leading={<Link2 size={18} />}
            onClick={() => copy('link')}
          />
        </div>
      </div>
    </Modal>
  )
}
