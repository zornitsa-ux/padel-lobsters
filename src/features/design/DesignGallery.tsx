import { useState } from 'react'
import {
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  ArrowUpRight,
  Inbox,
  X,
  ArrowUp,
  ArrowDown,
  Info,
} from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { ActionRow } from '../../components/ui/ActionRow'
import { Button } from '../../components/ui/Button'
import { TextButton } from '../../components/ui/TextButton'
import { IconButton } from '../../components/ui/IconButton'
import ShareWhatsAppButton from '../../components/ui/ShareWhatsAppButton'
import AddToCalendarButton from '../../components/ui/AddToCalendarButton'
import { AvatarPicker } from '../../components/ui/AvatarPicker'
import { AlertBox } from '../../components/ui/AlertBox'
import { Badge, type BadgeProps } from '../../components/ui/Badge'
import { Chip, ChipGroup } from '../../components/ui/Chip'
import { Disclosure } from '../../components/ui/Disclosure'
import { EmptyState } from '../../components/ui/EmptyState'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Spinner } from '../../components/ui/Spinner'
import { Skeleton } from '../../components/ui/Skeleton'

// Dev-only (`/design`). Each design-system step adds its components here.

const BADGE_VARIANTS: BadgeProps['variant'][] = [
  'paid',
  'unpaid',
  'pending',
  'waitlist',
  'info',
  'gold',
  'silver',
  'league-draft',
  'league-group-stage',
  'league-knockout',
  'league-completed',
]

const SAMPLE_EVENT = { id: 'sample', name: 'Lobster Cup', date: '2026-12-05', time: '19:00' }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-3">
      <h2 className="text-sm font-bold text-lob-dark">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-2xs font-semibold uppercase tracking-wide text-lob-muted">{label}</p>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  )
}

function ButtonSection() {
  return (
    <Section title="Button">
      {(['lg', 'md', 'sm'] as const).map((size) => (
        <Row key={size} label={`size="${size}"`}>
          <Button size={size}>Primary</Button>
          <Button size={size} variant="secondary">
            Secondary
          </Button>
          <Button size={size} variant="neutral">
            Neutral
          </Button>
          <Button size={size} variant="danger">
            Danger
          </Button>
        </Row>
      ))}
      <Row label="destructive: confirm vs other">
        <Button variant="danger">Delete season</Button>
        <TextButton tone="destructive" size="sm" icon={<Trash2 size={14} />}>
          Remove
        </TextButton>
      </Row>
      <Row label="icon, disabled">
        <Button icon={<Plus />}>Add player</Button>
        <Button disabled>Disabled</Button>
        <Button variant="secondary" disabled>
          Disabled
        </Button>
      </Row>
      <Row label="links: to / href external / disabled">
        <Button variant="secondary" to="/design">
          Router link
        </Button>
        <Button variant="neutral" href="https://example.com" external icon={<ArrowUpRight />}>
          New tab
        </Button>
        <Button variant="neutral" href="https://example.com" disabled>
          Disabled link
        </Button>
      </Row>
      <Row label='utility actions: variant="neutral" size="sm"'>
        <ShareWhatsAppButton tournament={SAMPLE_EVENT} variant="compact" />
        <AddToCalendarButton tournament={SAMPLE_EVENT} variant="compact" />
      </Row>
      <Row label="fullWidth · ActionRow (alternative first, confirm last)">
        <Button fullWidth>Register for this event</Button>
        <div className="w-full">
          <ActionRow>
            <Button variant="secondary">Cancel</Button>
            <Button>Save</Button>
          </ActionRow>
        </div>
      </Row>
    </Section>
  )
}

function TextButtonSection() {
  return (
    <Section title="TextButton">
      <Row label="tone">
        <TextButton>Accent</TextButton>
        <TextButton tone="primary">Primary</TextButton>
        <TextButton tone="destructive">Destructive</TextButton>
        <TextButton tone="warning">Warning</TextButton>
        <TextButton tone="neutral">Neutral</TextButton>
        <TextButton tone="neutral" to="/design">
          Neutral link
        </TextButton>
        <TextButton disabled>Disabled</TextButton>
      </Row>
      <Row label="size, icon, to / href / href external">
        <TextButton size="sm">Small</TextButton>
        <TextButton to="/design" icon={<ArrowUpRight size={12} />}>
          Router link
        </TextButton>
        <p className="text-xs text-lob-muted">
          Inline in a sentence:{' '}
          <TextButton size="inherit" href="mailto:hello@example.com">
            email link
          </TextButton>{' '}
          or{' '}
          <TextButton size="inherit" href="https://example.com" external>
            external link
          </TextButton>
          .
        </p>
      </Row>
    </Section>
  )
}

function IconButtonSection() {
  return (
    <Section title="IconButton">
      {(['md', 'sm'] as const).map((size) => (
        <Row key={size} label={`size="${size}"`}>
          <IconButton size={size} aria-label="Edit">
            <Pencil />
          </IconButton>
          <IconButton size={size} variant="accent" aria-label="Edit">
            <Pencil />
          </IconButton>
          <IconButton size={size} variant="success" aria-label="Add">
            <Plus />
          </IconButton>
          <IconButton size={size} variant="destructive" aria-label="Delete">
            <Trash2 />
          </IconButton>
        </Row>
      ))}
      <Row label='variant="ghost" · "ghost-destructive"'>
        <IconButton variant="ghost" aria-label="Close">
          <X />
        </IconButton>
        <IconButton variant="ghost" size="sm" aria-label="Move up">
          <ArrowUp />
        </IconButton>
        <IconButton variant="ghost" size="sm" aria-label="Move down" disabled>
          <ArrowDown />
        </IconButton>
        <IconButton variant="ghost-destructive" size="sm" aria-label="Delete">
          <Trash2 />
        </IconButton>
      </Row>
      <Row label='variant="on-dark"'>
        <div className="flex items-center gap-2 rounded-xl bg-header p-2">
          <IconButton variant="on-dark" aria-label="Close">
            <X />
          </IconButton>
          <IconButton variant="on-dark" size="sm" aria-label="Help">
            <Info />
          </IconButton>
        </div>
      </Row>
      <Row label="AvatarPicker">
        <AvatarPicker preview={null} onChange={() => {}} />
      </Row>
    </Section>
  )
}

function StatusSection() {
  return (
    <Section title="AlertBox and Badge">
      {(['info', 'warning', 'success', 'error'] as const).map((variant) => (
        <AlertBox key={variant} variant={variant} icon={<AlertCircle size={14} />}>
          AlertBox variant=&quot;{variant}&quot;
        </AlertBox>
      ))}
      <Row label="Badge variant">
        {BADGE_VARIANTS.map((variant) => (
          <Badge key={variant} variant={variant} label={variant} />
        ))}
      </Row>
    </Section>
  )
}

const ROUNDS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: `Round ${n}` }))

function ChoiceSection() {
  const [side, setSide] = useState('left')
  const [group, setGroup] = useState('A')
  const [round, setRound] = useState(1)
  const [filter, setFilter] = useState('all')
  const [sizes, setSizes] = useState<string[]>(['M'])
  const toggleSize = (size: string) =>
    setSizes((current) =>
      current.includes(size) ? current.filter((s) => s !== size) : [...current, size],
    )
  return (
    <Section title="Chip and SegmentedControl">
      <Row label="SegmentedControl (fill, 2–4 choices)">
        <div className="w-full">
          <SegmentedControl
            options={[
              { value: 'left', label: 'Left' },
              { value: 'right', label: 'Right' },
              { value: 'both', label: 'Both' },
            ]}
            value={side}
            onChange={setSide}
            ariaLabel="Preferred side"
          />
        </div>
      </Row>
      <Row label="SegmentedControl with detail">
        <div className="w-full">
          <SegmentedControl
            options={[
              { value: 'A', label: 'Group A', detail: '3 teams · suggested' },
              { value: 'B', label: 'Group B', detail: '4 teams' },
            ]}
            value={group}
            onChange={setGroup}
            ariaLabel="Group"
          />
        </div>
      </Row>
      <Row label='SegmentedControl layout="scroll"'>
        <div className="w-full min-w-0">
          <SegmentedControl
            layout="scroll"
            options={ROUNDS}
            value={round}
            onChange={setRound}
            ariaLabel="Round"
          />
        </div>
      </Row>
      <Row label='SegmentedControl layout="wrap" with counts'>
        <SegmentedControl
          layout="wrap"
          options={[
            { value: 'all', label: 'All', count: 24 },
            { value: 'unpaid', label: 'Unpaid', count: 3 },
            { value: 'paid', label: 'Confirmed', count: 21 },
          ]}
          value={filter}
          onChange={setFilter}
          ariaLabel="Payment status"
        />
      </Row>
      <Row label="Chip toggles in a ChipGroup (multi-select)">
        <ChipGroup ariaLabel="Sizes">
          {['S', 'M', 'L', 'XL'].map((size) => (
            <Chip key={size} selected={sizes.includes(size)} onClick={() => toggleSize(size)}>
              {size}
            </Chip>
          ))}
          <Chip disabled selected={false}>
            XXL
          </Chip>
        </ChipGroup>
      </Row>
      <Row label="Chip link (no toggle state)">
        <Chip to="/design">Lobster Cup</Chip>
      </Row>
    </Section>
  )
}

function StatesSection() {
  const [open, setOpen] = useState(false)
  return (
    <Section title="Disclosure, empty and loading">
      <Disclosure expanded={open} onToggle={() => setOpen((o) => !o)}>
        Advanced
      </Disclosure>
      {open && <p className="text-xs text-lob-muted">Extra detail shown by Disclosure.</p>}
      <EmptyState
        icon={<Inbox size={36} />}
        title="Nothing here yet"
        description="EmptyState with an action."
        action={<Button>Go to Events</Button>}
      />
      <Spinner className="py-4" />
      <Skeleton className="h-10 w-full" />
    </Section>
  )
}

export default function DesignGallery() {
  return (
    <div className="space-y-4">
      <PageHeader title="Design system" eyebrow="Dev only" />
      <ButtonSection />
      <TextButtonSection />
      <IconButtonSection />
      <StatusSection />
      <ChoiceSection />
      <StatesSection />
    </div>
  )
}
