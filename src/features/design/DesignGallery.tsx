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
  Eye,
  ChevronRight,
  MoreVertical,
  Gamepad2,
  SlidersHorizontal,
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
import Avatar from '../../components/ui/Avatar'
import { Chip, ChipGroup } from '../../components/ui/Chip'
import { CollapsibleCard } from '../../components/ui/CollapsibleCard'
import { Disclosure } from '../../components/ui/Disclosure'
import { EmptyState } from '../../components/ui/EmptyState'
import { Menu, MenuItem, MenuList, MenuSeparator } from '../../components/ui/Menu'
import { OptionRow } from '../../components/ui/OptionRow'
import { ImageTile, OptionTile } from '../../components/ui/OptionTile'
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

// `block` gives a full-width child (a fill SegmentedControl) the whole row.
function Row({
  label,
  block = false,
  children,
}: {
  label: string
  block?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-2xs font-semibold uppercase tracking-wide text-lob-muted">{label}</p>
      {block ? children : <div className="flex flex-wrap items-center gap-2">{children}</div>}
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
        <ActionRow>
          <Button variant="secondary">Cancel</Button>
          <Button>Save</Button>
        </ActionRow>
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
      <Row label="SegmentedControl (fill, 2–4 choices)" block>
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
      </Row>
      <Row label="SegmentedControl with detail" block>
        <SegmentedControl
          options={[
            { value: 'A', label: 'Group A', detail: '3 teams · suggested' },
            { value: 'B', label: 'Group B', detail: '4 teams' },
          ]}
          value={group}
          onChange={setGroup}
          ariaLabel="Group"
        />
      </Row>
      <Row label='SegmentedControl layout="scroll"' block>
        <SegmentedControl
          layout="scroll"
          options={ROUNDS}
          value={round}
          onChange={setRound}
          ariaLabel="Round"
        />
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
      <Row label="SegmentedControl invalid (required, nothing picked)">
        <SegmentedControl
          layout="wrap"
          invalid
          options={['S', 'M', 'L'].map((size) => ({ value: size, label: size }))}
          value={null}
          onChange={() => {}}
          ariaLabel="Size"
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

const SAMPLE_PLAYERS = [
  { id: 'p1', name: 'Ana Ruiz', level: '3.5' },
  { id: 'p2', name: 'Ben Okafor', level: '2.8' },
  { id: 'p3', name: 'Chloé Martin', level: '4.1' },
]

const SAMPLE_PHOTOS = ['/logo-256.webp', '/lobster-way/transfer-step-1.png', '/favicon-64.png']

function OptionSection() {
  const [picked, setPicked] = useState('p1')
  const [tile, setTile] = useState('p2')
  const [photo, setPhoto] = useState(0)
  return (
    <Section title="OptionRow and OptionTile">
      <Row label="OptionRow selected (pick one player)" block>
        <div className="space-y-1">
          {SAMPLE_PLAYERS.map((p) => (
            <OptionRow
              key={p.id}
              selected={picked === p.id}
              onClick={() => setPicked(p.id)}
              leading={<Avatar player={p} size="sm" />}
              title={p.name}
              trailing={`Lv ${p.level}`}
            />
          ))}
          <OptionRow
            selected={false}
            disabled
            leading={<Avatar player={{ name: 'Dee Sol' }} size="sm" />}
            title="Dee Sol"
            trailing="Lv 3.0"
          />
        </div>
      </Row>
      <Row label="OptionRow acting straight away · subtitle · actions · trailing chevron" block>
        <div className="space-y-1">
          <OptionRow
            onClick={() => {}}
            leading={<Avatar player={{ name: 'Ana Ruiz' }} size="sm" />}
            title="Ana Ruiz"
            subtitle="Lv 3.5"
            actions={
              <IconButton aria-label="Show email" size="sm">
                <Eye />
              </IconButton>
            }
          />
          <OptionRow
            to="/design"
            title="3 player signups awaiting approval"
            trailing={<ChevronRight size={16} className="text-lob-muted-light" />}
          />
        </div>
      </Row>
      <Row label="OptionTile (grid): default · selected · disabled · muted read-only" block>
        <div className="grid grid-cols-2 gap-2">
          {SAMPLE_PLAYERS.slice(0, 2).map((p) => (
            <OptionTile key={p.id} selected={tile === p.id} onClick={() => setTile(p.id)}>
              <span className="font-semibold text-sm text-lob-dark">{p.name}</span>
              <span className="text-xs text-lob-muted">R2: you &amp; {p.name.split(' ')[0]}</span>
            </OptionTile>
          ))}
          <OptionTile disabled onClick={() => {}}>
            <span className="font-semibold text-sm text-lob-dark">You</span>
            <span className="text-xs text-lob-muted">that&apos;s you</span>
          </OptionTile>
          <OptionTile muted>
            <span className="font-semibold text-sm text-lob-dark">Best smash</span>
            <span className="text-xs font-semibold text-lob-success">Voted: Ana</span>
          </OptionTile>
        </div>
      </Row>
      <Row label="ImageTile (photo switcher)">
        {SAMPLE_PHOTOS.map((src, i) => (
          <ImageTile
            key={src}
            src={src}
            selected={photo === i}
            onClick={() => setPhoto(i)}
            aria-label={`Photo ${i + 1} of ${SAMPLE_PHOTOS.length}`}
          />
        ))}
      </Row>
    </Section>
  )
}

function MenuSection() {
  const [status, setStatus] = useState('paid')
  const [view, setView] = useState('play')
  return (
    <Section title="Menu and MenuItem">
      <Row label="MenuList under a search field (always open here) · MenuSeparator" block>
        <div className="h-72">
          <div className="relative">
            <input
              className="input w-full"
              placeholder="Search by name…"
              defaultValue="Jo"
              readOnly
            />
            <MenuList label="Player options" align="stretch" keepFocus>
              {SAMPLE_PLAYERS.map((p) => (
                <MenuItem key={p.id} icon={<Avatar player={p} size="xs" />} onSelect={() => {}}>
                  {p.name}
                </MenuItem>
              ))}
              <MenuSeparator />
              <MenuItem icon={<Plus />} onSelect={() => {}}>
                Create placeholder: Jo
              </MenuItem>
            </MenuList>
          </div>
        </div>
      </Row>
      <Row label="icon items · danger tone (event admin menu)">
        <Menu
          label="Admin tools"
          align="left"
          trigger={(props) => (
            <IconButton {...props} aria-label="Admin tools">
              <MoreVertical />
            </IconButton>
          )}
        >
          <MenuItem icon={<Pencil />} onSelect={() => {}}>
            Edit event
          </MenuItem>
          <MenuItem icon={<Trash2 />} tone="danger" onSelect={() => {}}>
            Delete event
          </MenuItem>
        </Menu>
        <Menu
          label="Payment method"
          align="left"
          trigger={(props) => (
            <Button size="sm" {...props}>
              Mark Paid ▾
            </Button>
          )}
        >
          {['Tikkie', 'Cash', 'Bank transfer'].map((m) => (
            <MenuItem key={m} onSelect={() => {}}>
              {m}
            </MenuItem>
          ))}
        </Menu>
      </Row>
      <Row label="showLabel · hint · current (status override)">
        <Menu
          label="Set status"
          showLabel
          align="left"
          trigger={(props) => (
            <IconButton {...props} aria-label="More payment options" size="sm">
              <MoreVertical />
            </IconButton>
          )}
        >
          {[
            { value: 'unpaid', label: 'Unpaid', hint: 'Never paid' },
            { value: 'pending', label: 'Paid', hint: 'Player says they paid' },
            { value: 'paid', label: 'Confirmed', hint: 'Admin verified' },
          ].map((s) => (
            <MenuItem
              key={s.value}
              current={s.value === status}
              hint={s.hint}
              onSelect={() => setStatus(s.value)}
            >
              {s.label}
            </MenuItem>
          ))}
        </Menu>
      </Row>
      <Row label="drawer choice: OptionRow selected (Oscars admin menu)" block>
        <div className="space-y-1">
          <OptionRow
            selected={view === 'play'}
            leading={<Gamepad2 size={18} className="text-lob-muted" />}
            title="Play & vote"
            subtitle="Cast your own votes as a participant."
            onClick={() => setView('play')}
          />
          <OptionRow
            selected={view === 'admin'}
            leading={<SlidersHorizontal size={18} className="text-lob-muted" />}
            title="Admin controls"
            subtitle="Start, monitor, end and share the games."
            onClick={() => setView('admin')}
          />
        </div>
      </Row>
    </Section>
  )
}

function CollapsibleSectionDemo() {
  const [open, setOpen] = useState(false)
  const [rowOpen, setRowOpen] = useState(false)
  return (
    <Section title="CollapsibleCard">
      <CollapsibleCard
        className="rounded-xl border border-lob-line bg-lob-well p-3 space-y-2"
        expanded={open}
        onToggle={() => setOpen((o) => !o)}
        header={<span className="text-sm font-semibold text-lob-slate">Best Lobster</span>}
        summary={<p className="text-xs text-lob-muted">summary stays visible</p>}
      >
        <p className="text-xs text-lob-muted">Body shown while expanded.</p>
      </CollapsibleCard>
      <CollapsibleCard
        className="rounded-xl border border-lob-line bg-lob-well p-3 space-y-2"
        expanded={rowOpen}
        onToggle={() => setRowOpen((o) => !o)}
        leading={
          <IconButton variant="ghost" size="sm" aria-label="Move up">
            <ArrowUp />
          </IconButton>
        }
        actions={
          <IconButton variant="ghost-destructive" size="sm" aria-label="Delete">
            <Trash2 />
          </IconButton>
        }
        header={
          <span className="text-sm font-medium text-lob-slate truncate">leading + actions</span>
        }
      >
        <p className="text-xs text-lob-muted">Reorder and delete sit outside the toggle.</p>
      </CollapsibleCard>
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
      <OptionSection />
      <MenuSection />
      <CollapsibleSectionDemo />
      <StatesSection />
    </div>
  )
}
