import { useEffect, useReducer, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/useApp'
import { useConfirm } from '../../lib/confirmBus'
import { useToast } from '../../lib/toastBus'
import { usePlayer } from '../players/usePlayers'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { AlertBox } from '../../components/ui/AlertBox'
import { StepHeader } from '../../components/ui/StepHeader'
import {
  canFinish,
  initialLevellingState,
  levellingReducer,
  PLAYTOMIC_STEP,
  toPayload,
  type LevellingState,
} from './levellingFlow'
import { QUESTIONS, TOTAL_STEPS } from './levellingQuestions'
import { clearDraft, readDraft, saveDraft } from './levellingDraft'
import { returnPathFrom } from './levellingRoutes'
import { useCompleteLevelling, useMyLevelling } from './useMyLevelling'
import QuestionStep from './QuestionStep'
import PlaytomicStep from './PlaytomicStep'

const SAVE_ERROR = 'We couldn’t save your answers. Please try again.'

const finishedToast = ({ name }: { name: string | undefined }) => {
  const first = name?.split(' ')[0]
  return `${first ? `Thanks, ${first}! ` : 'Thanks! '}You’re all set and ready to register for an event.`
}

/** The six-step levelling flow (DESIGN §2.2). Finishing never registers. */
export default function LevellingPage() {
  const { session, sessionSettled } = useApp()
  const userId = session?.user?.id ?? null
  const from = returnPathFrom({ search: useLocation().search })
  const levelling = useMyLevelling()

  if (sessionSettled && !userId) return <Navigate to={from} replace />
  if (!userId || !levelling.data) {
    return levelling.isError ? (
      <div className="pt-5">
        <AlertBox variant="error">We couldn’t load this. Pull to refresh or try again.</AlertBox>
      </div>
    ) : (
      <Spinner />
    )
  }
  return (
    <LevellingFlow
      userId={userId}
      from={from}
      needsLevelling={levelling.data.needsLevelling}
      levelOnFile={levelling.data.levelOnFile}
    />
  )
}

function LevellingFlow({
  userId,
  from,
  needsLevelling,
  levelOnFile,
}: {
  userId: string
  from: string
  needsLevelling: boolean
  levelOnFile: number | null
}) {
  const navigate = useNavigate()
  const confirm = useConfirm()
  const { showToast } = useToast()
  const { data: player } = usePlayer(userId)
  const complete = useCompleteLevelling()
  const [error, setError] = useState('')
  // Set once Finish succeeds, so the refetched `needsLevelling: false` can't redirect first.
  const finished = useRef(false)
  const [state, dispatch] = useReducer(
    levellingReducer,
    undefined,
    (): LevellingState => readDraft({ userId }) ?? initialLevellingState({ levelOnFile }),
  )

  useEffect(() => {
    if (!finished.current) saveDraft({ userId, state })
  }, [userId, state])

  if (!needsLevelling && !finished.current) return <Navigate to={from} replace />

  const close = async () => {
    const stop = await confirm({
      title: 'Stop now?',
      message: 'Your answers so far are kept.',
      confirmLabel: 'Stop',
      cancelLabel: 'Keep going',
    })
    if (stop) navigate(from)
  }

  const back = () => (state.step === 0 ? void close() : dispatch({ type: 'back' }))

  const finish = async () => {
    const payload = toPayload(state)
    if (!payload) return
    setError('')
    const status = await complete.mutateAsync({ payload }).catch(() => 'error' as const)
    if (status === 'error' || status === 'invalid_answers') {
      setError(SAVE_ERROR)
      return
    }
    finished.current = true
    clearDraft({ userId })
    navigate(from)
    if (status !== 'not_needed') {
      showToast({ variant: 'success', message: finishedToast({ name: player?.name }) })
    }
  }

  const onPlaytomicStep = state.step === PLAYTOMIC_STEP
  return (
    <div className="pt-5 space-y-6">
      <StepHeader
        step={state.step + 1}
        total={TOTAL_STEPS}
        onBack={back}
        onClose={() => void close()}
        closeLabel="Stop setting your level"
      />
      {onPlaytomicStep ? (
        <PlaytomicStep
          playtomic={state.playtomic}
          prefilled={state.prefilled}
          onChoose={(choice) => dispatch({ type: 'choosePlaytomic', choice })}
          onType={(text) => dispatch({ type: 'typePlaytomic', text })}
        />
      ) : (
        <QuestionStep
          key={state.step}
          question={QUESTIONS[state.step]}
          answer={state.answers[QUESTIONS[state.step].key]}
          onAnswer={(code) => dispatch({ type: 'answer', key: QUESTIONS[state.step].key, code })}
        />
      )}
      {onPlaytomicStep && (
        <div className="space-y-3">
          {error && <AlertBox variant="error">{error}</AlertBox>}
          <Button
            onClick={() => void finish()}
            disabled={!canFinish(state) || complete.isPending}
            fullWidth
          >
            {complete.isPending ? 'Saving…' : 'Finish'}
          </Button>
        </div>
      )}
    </div>
  )
}
