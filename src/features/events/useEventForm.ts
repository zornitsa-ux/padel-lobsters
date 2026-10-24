import { useState } from 'react'
import { useAddTournament, useUpdateTournament } from './useTournaments'
import { useRegistrations } from './useRegistrations'
import { emptyForm, type EventFormValues } from './eventConstants'
import type { SetEventFormCourt } from './EventFormModal'
import {
  buildEventData,
  formFromTournament,
  isEntryModeLocked,
  isFormatLocked,
  withSavedFormat,
} from './eventFormModel'
import type { NormalisedTournament } from '../../lib/normalise'

export type EventFormSaveResult = 'saved' | 'format_reverted'

// The admin event form behind EventFormModal: open, edit courts, save, and the
// format lock. The server refuses an entry-mode change once anyone has signed
// up (entry_mode_locked); `save` then puts the saved format back and resolves
// 'format_reverted' so the caller can say why. Any other failure throws.
export function useEventForm() {
  const addMut = useAddTournament()
  const updateMut = useUpdateTournament()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<NormalisedTournament | null>(null)
  const [form, setForm] = useState<EventFormValues>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [serverLocked, setServerLocked] = useState(false)
  const { data: registrations = [], isPending: registrationsPending } = useRegistrations(
    editing?.id ?? null,
  )

  const show = ({
    next,
    tournament,
  }: {
    next: EventFormValues
    tournament: NormalisedTournament | null
  }) => {
    setForm(next)
    setEditing(tournament)
    setServerLocked(false)
    setOpen(true)
  }
  const openNew = () => show({ next: emptyForm, tournament: null })
  const openEdit = (tournament: NormalisedTournament) =>
    show({ next: formFromTournament({ tournament }), tournament })

  const save = async (): Promise<EventFormSaveResult> => {
    setSaving(true)
    try {
      const data = buildEventData({ form })
      if (editing) await updateMut.mutateAsync({ id: editing.id, data })
      else await addMut.mutateAsync(data)
      setOpen(false)
      return 'saved'
    } catch (err) {
      if (!editing || !isEntryModeLocked(err)) throw err
      setForm((f) => withSavedFormat({ form: f, tournament: editing }))
      setServerLocked(true)
      return 'format_reverted'
    } finally {
      setSaving(false)
    }
  }

  const setCourts = (update: (courts: EventFormValues['courts']) => EventFormValues['courts']) =>
    setForm((f) => ({ ...f, courts: update(f.courts) }))
  const setCourt: SetEventFormCourt = (i, field, value) =>
    setCourts((courts) => courts.map((c, idx) => (idx === i ? { ...c, [field]: value } : c)))

  return {
    openNew,
    openEdit,
    save,
    /** Everything EventFormModal needs except onSubmit. */
    modalProps: {
      open,
      editId: editing?.id ?? null,
      form,
      setForm,
      saving,
      formatLocked: isFormatLocked({
        editing: !!editing,
        serverLocked,
        registrationsPending,
        registrations,
      }),
      registeredTeams: registrations.filter((r) => r.status === 'registered').length / 2,
      onClose: () => setOpen(false),
      addCourt: () => setCourts((courts) => [...courts, { name: '', booked: false }]),
      removeCourt: (i: number) => setCourts((courts) => courts.filter((_, idx) => idx !== i)),
      setCourt,
    },
  }
}
