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
  ChevronDown,
  ArrowRight,
  MoreVertical,
  Gamepad2,
  SlidersHorizontal,
  Check,
  EyeOff,
  Search,
  Users,
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
import { FormError } from '../../components/ui/FormError'
import { useFieldError } from '../../components/ui/useFieldError'
import { Badge, BADGE_TONES } from '../../components/ui/Badge'
import PaymentStatusBadge from '../events/registration/PaymentStatusBadge'
import { PAYMENT_STATUSES } from '../events/paymentStatus'
import { STATUS_CONFIG } from '../merch/statusConfig'
import Avatar from '../../components/ui/Avatar'
import { Chip, ChipGroup } from '../../components/ui/Chip'
import { CollapsibleCard } from '../../components/ui/CollapsibleCard'
import { Disclosure } from '../../components/ui/Disclosure'
import { EmptyState } from '../../components/ui/EmptyState'
import { SignInPrompt } from '../../components/ui/SignInPrompt'
import { Menu, MenuItem, MenuSeparator } from '../../components/ui/Menu'
import { MenuList } from '../../components/ui/MenuList'
import { Modal } from '../../components/ui/Modal'
import { FullScreenDialog } from '../../components/ui/FullScreenDialog'
import { Drawer } from '../../components/ui/Drawer'
import { useConfirm } from '../../lib/confirmBus'
import { CardLink } from '../../components/ui/CardLink'
import { LinkCard, LinkCardIcon } from '../../components/ui/LinkCard'
import { LinkRow, ListCard } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
import { OptionRow } from '../../components/ui/OptionRow'
import { ImageTile, OptionTile } from '../../components/ui/OptionTile'
import { SegmentedControl } from '../../components/ui/SegmentedControl'
import { Spinner } from '../../components/ui/Spinner'
import { Skeleton } from '../../components/ui/Skeleton'

// Dev-only (`/design`). Each design-system step adds its components here.

const SAMPLE_EVENT = { id: 'sample', name: 'Lobster Cup', date: '2026-12-05', time: '19:00' }

function GallerySection({ title, children }: { title: string; children: React.ReactNode }) {
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
    <GallerySection title="Button">
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
      <Row label="grow (fills what a fixed item leaves)" block>
        <div className="flex items-center gap-2">
          <Button grow icon={<Plus />}>
            Add category
          </Button>
          <TextButton tone="neutral">Reset to defaults</TextButton>
        </div>
      </Row>
      <Row label="trailingIcon (onward arrow, menu chevron)">
        <Button variant="neutral" size="sm" trailingIcon={<ArrowRight />}>
          Next unscored match
        </Button>
        <Button size="sm" trailingIcon={<ChevronDown />}>
          Mark Paid
        </Button>
      </Row>
      <Row label='variant="on-dark" (banners, raffle)' block>
        <div className="bg-celebrate rounded-2xl p-4 space-y-2">
          <Button variant="on-dark" fullWidth>
            See Full Results
          </Button>
          <Button variant="on-dark" size="sm" icon={<SlidersHorizontal />}>
            Manage eligibility
          </Button>
        </div>
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
    </GallerySection>
  )
}

function TextButtonSection() {
  return (
    <GallerySection title="TextButton">
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
      <Row label='size="lg" (headline name) · truncate · hitArea' block>
        <div className="space-y-2">
          <TextButton size="lg" truncate>
            Net Gains and the Very Long Team Name Club
          </TextButton>
          <div className="flex items-center gap-1 min-h-10 text-sm text-lob-slate truncate">
            <TextButton size="inherit" truncate hitArea>
              Alexandra Fitzgerald-Hughes-Montgomery
            </TextButton>
            <span className="shrink-0">♀ 🤚</span>
          </div>
          <p className="text-xs text-lob-warning">
            Ana vs Ben — repeat{' '}
            <TextButton tone="warning" hitArea>
              Fix
            </TextButton>
          </p>
        </div>
      </Row>
    </GallerySection>
  )
}

function IconButtonSection() {
  return (
    <GallerySection title="IconButton">
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
    </GallerySection>
  )
}

function StatusSection() {
  return (
    <GallerySection title="AlertBox and Badge">
      <Row label="AlertBox variant (error is role alert, the rest role status)" block>
        <div className="space-y-2">
          {(['info', 'warning', 'success', 'error'] as const).map((variant) => (
            <AlertBox key={variant} variant={variant} icon={<AlertCircle />}>
              AlertBox variant=&quot;{variant}&quot;
            </AlertBox>
          ))}
        </div>
      </Row>
      <Row label='size="sm" (inside a card, row or form)' block>
        <div className="space-y-2">
          <AlertBox variant="warning" size="sm" icon={<AlertCircle />}>
            Not published yet — only admins can see this.
          </AlertBox>
          <AlertBox variant="error" size="sm" onDismiss={() => {}}>
            Couldn&apos;t save. Try again.
          </AlertBox>
        </div>
      </Row>
      <Row label="title · action · onDismiss" block>
        <div className="space-y-2">
          <AlertBox
            variant="warning"
            icon={<AlertCircle />}
            title="2 pending transfers"
            action={<TextButton tone="warning">Review</TextButton>}
          />
          <AlertBox variant="error" title="Rule violations" onDismiss={() => {}}>
            R2: the same pair plays twice.
          </AlertBox>
        </div>
      </Row>
      <Row label="actions (buttons under the text)" block>
        <AlertBox
          variant="warning"
          title="A player wants to give you their spot"
          actions={
            <ActionRow>
              <Button variant="neutral">Decline</Button>
              <Button>Accept</Button>
            </ActionRow>
          }
        >
          Summer Social · Sat 14 Nov
        </AlertBox>
      </Row>
      <Row label="Badge tone (one size; meanings map onto tones)">
        {BADGE_TONES.map((tone) => (
          <Badge key={tone} tone={tone} label={tone} />
        ))}
      </Row>
      <Row label="Badge icon (the badge sizes it)">
        <Badge tone="success" icon={<Check />} label="You're registered!" />
        <Badge tone="neutral" icon={<EyeOff />} label="Hidden" />
      </Row>
      <Row label="PaymentStatusBadge (paymentStatus.ts; detail for the method)">
        {[...PAYMENT_STATUSES, 'covered'].map((status) => (
          <PaymentStatusBadge key={status} paymentStatus={status} />
        ))}
        <PaymentStatusBadge paymentStatus="paid" detail="Tikkie" />
      </Row>
      <Row label="Merch order status (statusConfig.ts)">
        {Object.entries(STATUS_CONFIG).map(([status, { label, tone, icon: Icon }]) => (
          <Badge key={status} tone={tone} label={label} icon={<Icon />} />
        ))}
      </Row>
    </GallerySection>
  )
}

const ROUNDS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: `Round ${n}` }))

function FormErrorSection() {
  const { errorId, fieldProps } = useFieldError({ message: 'Enter a level between 0 and 7.' })
  return (
    <GallerySection title="FormError">
      <Row label="Under a field (useFieldError ties it to the input)" block>
        <div className="space-y-1">
          <input className="input" defaultValue="9" aria-label="Playtomic level" {...fieldProps} />
          <FormError id={errorId} message="Enter a level between 0 and 7." />
        </div>
      </Row>
      <Row label="action (inline follow-up)" block>
        <FormError
          message="That email already has an account."
          action={<TextButton size="inherit">Search members</TextButton>}
        />
      </Row>
      <Row label='A failed save or load is AlertBox variant="error", not FormError' block>
        <AlertBox variant="error" size="sm">
          Could not sign you up. Please try again.
        </AlertBox>
      </Row>
    </GallerySection>
  )
}

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
    <GallerySection title="Chip and SegmentedControl">
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
    </GallerySection>
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
    <GallerySection title="OptionRow and OptionTile">
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
    </GallerySection>
  )
}

function CardLinkSection() {
  return (
    <GallerySection title="CardLink and LinkCard">
      <Row label="LinkCard (title, subtitle, leading, trailing; built on CardLink)" block>
        <div className="space-y-2">
          <LinkCard
            to="/design"
            title="The Lobster Way"
            subtitle="How we play, pay and swap spots"
            leading={
              <LinkCardIcon>
                <Info size={18} />
              </LinkCardIcon>
            }
          />
          <LinkCard
            onClick={() => {}}
            title="Season 1"
            trailing={<Badge tone="brand" label="Live" />}
          />
        </div>
      </Row>
      <Row label="CardLink flush (full-bleed band, e.g. the league card)" block>
        <CardLink to="/design" flush>
          <div className="bg-gradient-to-r from-lob-teal to-lob-teal-dark px-4 py-3">
            <p className="font-bold text-white">Lobster League</p>
          </div>
          <div className="bg-lob-teal-light px-4 py-2.5 flex items-center justify-between gap-2">
            <p className="text-sm text-lob-muted">#2 Group A · 3 matches remaining</p>
            <span className="text-xs font-semibold text-lob-teal">View →</span>
          </div>
        </CardLink>
      </Row>
    </GallerySection>
  )
}

function SectionListSection() {
  return (
    <GallerySection title="Section and ListCard">
      <Row label="Section (heading on the background) with a ListCard of LinkRows" block>
        <div className="rounded-2xl bg-lob-cream p-3">
          <Section
            title="Players (3)"
            icon={<Users />}
            action={<TextButton onClick={() => {}}>Invite</TextButton>}
          >
            <ListCard label="Players">
              <LinkRow
                to="/design"
                highlighted
                leading={<Avatar player={{ name: 'Theo' }} size="md" />}
                title={
                  <span className="flex items-center gap-1.5">
                    Theo <Badge tone="outline" label="You" />
                  </span>
                }
                trailing={<span className="text-sm font-bold text-lob-teal">2.5</span>}
              />
              <LinkRow
                to="/design"
                leading={<Avatar player={{ name: 'Mara' }} size="md" />}
                title="Mara"
                trailing={<span className="text-sm font-bold text-lob-teal">3.0</span>}
              />
              <LinkRow
                onClick={() => {}}
                leading={<Avatar player={{ name: 'Lena' }} size="md" />}
                title="Lena"
                subtitle="Opens a sheet (onClick)"
              />
            </ListCard>
          </Section>
        </div>
      </Row>
    </GallerySection>
  )
}

function MenuSection() {
  const [status, setStatus] = useState('paid')
  const [view, setView] = useState('play')
  return (
    <GallerySection title="Menu and MenuItem">
      <Row label="MenuList under a search field (always open here) · MenuSeparator" block>
        <div className="h-72">
          <div className="relative">
            <input
              className="input w-full"
              placeholder="Search by name…"
              defaultValue="Jo"
              readOnly
            />
            <MenuList label="Player options">
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
            <Button size="sm" trailingIcon={<ChevronDown />} {...props}>
              Mark Paid
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
    </GallerySection>
  )
}

type GalleryDialog = 'plain' | 'form' | 'fullscreen' | 'drawer'

function DialogSection() {
  const confirm = useConfirm()
  const [dialog, setDialog] = useState<GalleryDialog | null>(null)
  const [nestedSheetOpen, setNestedSheetOpen] = useState(false)
  const [view, setView] = useState<'schedule' | 'standings'>('schedule')
  const close = () => setDialog(null)
  const sheetOpen = dialog === 'plain' || dialog === 'form'
  return (
    <GallerySection title="Modal, FullScreenDialog, Drawer and ConfirmDialog">
      <Row label="Modal: dismissible, with a description · not dismissible, autoFocus field">
        <Button variant="secondary" onClick={() => setDialog('plain')}>
          Open sheet
        </Button>
        <Button variant="secondary" onClick={() => setDialog('form')}>
          Open form sheet
        </Button>
      </Row>
      <Row label="FullScreenDialog: X and Escape close · Drawer: X, Escape and a backdrop tap">
        <Button variant="secondary" onClick={() => setDialog('fullscreen')}>
          Open full screen
        </Button>
        <Button variant="secondary" onClick={() => setDialog('drawer')}>
          Open drawer
        </Button>
      </Row>
      <Row label="ConfirmDialog: focuses Confirm · destructive focuses Cancel">
        <Button
          variant="neutral"
          onClick={() => confirm({ title: 'Mark as paid?', message: 'Paid by Tikkie.' })}
        >
          Confirm
        </Button>
        <Button
          variant="neutral"
          onClick={() =>
            confirm({
              title: 'Delete season?',
              message: 'This removes every match.',
              confirmLabel: 'Delete',
              destructive: true,
            })
          }
        >
          Destructive confirm
        </Button>
      </Row>
      <Modal
        open={sheetOpen}
        onClose={close}
        title={dialog === 'form' ? 'Edit player' : 'Swap partner'}
        description={dialog === 'form' ? undefined : 'Pick who plays with Alex.'}
        dismissible={dialog !== 'form'}
        footer={
          <ActionRow>
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button onClick={() => confirm({ message: 'Save these changes?' })}>Save</Button>
          </ActionRow>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-lob-slate">
            {dialog === 'form'
              ? 'Escape and a backdrop tap do nothing here; use Cancel.'
              : 'Escape, a backdrop tap or a drag down closes it.'}
          </p>
          <input className="input w-full" placeholder="Name" autoFocus={dialog === 'form'} />
        </div>
      </Modal>
      <FullScreenDialog
        open={dialog === 'fullscreen'}
        onClose={close}
        title="Compare schedules"
        description="Your current schedule stays unless you choose the alternative."
        footer={
          <ActionRow>
            <Button variant="secondary" onClick={close}>
              Keep original
            </Button>
            <Button onClick={close}>Use alternative</Button>
          </ActionRow>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-lob-slate">
            A sheet, a menu or a confirm opened from here closes alone on Escape.
          </p>
          <ActionRow>
            <Button variant="neutral" onClick={() => setNestedSheetOpen(true)}>
              Open a sheet
            </Button>
            <Button variant="neutral" onClick={() => confirm({ message: 'Use this one?' })}>
              Confirm
            </Button>
          </ActionRow>
          <Menu
            label="Schedule tools"
            trigger={(props) => (
              <Button variant="neutral" trailingIcon={<ChevronDown />} {...props}>
                Tools
              </Button>
            )}
          >
            <MenuItem onSelect={() => {}}>Regenerate</MenuItem>
            <MenuItem onSelect={() => {}}>Reset to defaults</MenuItem>
          </Menu>
          <Skeleton className="h-96 w-full" />
        </div>
      </FullScreenDialog>
      <Modal open={nestedSheetOpen} onClose={() => setNestedSheetOpen(false)} title="Edit round">
        <p className="text-sm text-lob-slate">Escape closes this sheet only.</p>
      </Modal>
      <Drawer open={dialog === 'drawer'} onClose={close} title="View">
        <div className="space-y-1">
          <OptionRow
            selected={view === 'schedule'}
            title="Schedule"
            subtitle="Rounds and courts."
            onClick={() => setView('schedule')}
          />
          <OptionRow
            selected={view === 'standings'}
            title="Standings"
            subtitle="Points so far."
            onClick={() => setView('standings')}
          />
        </div>
      </Drawer>
    </GallerySection>
  )
}

function CollapsibleSectionDemo() {
  const [open, setOpen] = useState(false)
  const [rowOpen, setRowOpen] = useState(false)
  return (
    <GallerySection title="CollapsibleCard">
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
    </GallerySection>
  )
}

function StatesSection() {
  const [open, setOpen] = useState(false)
  return (
    <GallerySection title="Disclosure, empty, signed-out and loading">
      <Disclosure expanded={open} onToggle={() => setOpen((o) => !o)}>
        Advanced
      </Disclosure>
      {open && <p className="text-xs text-lob-muted">Extra detail shown by Disclosure.</p>}
      <EmptyState
        icon={<Inbox />}
        title="Nothing here yet"
        description="EmptyState: the page or tab body is empty."
        action={<Button>Go to Events</Button>}
      />
      <div className="card space-y-3">
        <h2 className="font-bold text-lob-dark">Registered teams</h2>
        <EmptyState
          variant="inline"
          icon={<Search />}
          title="No teams registered yet"
          description='variant="inline": a list inside a card, modal or headed section.'
        />
      </div>
      <SignInPrompt title="Sign in to see your tournament" />
      <div className="card space-y-3">
        <h2 className="font-bold text-lob-dark">Final standings</h2>
        <SignInPrompt variant="inline" title="Sign in to see the final standings." />
      </div>
      <div className="card space-y-3">
        <h2 className="font-bold text-lob-dark">Starting courts</h2>
        <Spinner size="inline" />
      </div>
      <Spinner />
      <Skeleton className="h-10 w-full" />
    </GallerySection>
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
      <FormErrorSection />
      <ChoiceSection />
      <OptionSection />
      <MenuSection />
      <DialogSection />
      <CardLinkSection />
      <SectionListSection />
      <CollapsibleSectionDemo />
      <StatesSection />
    </div>
  )
}
