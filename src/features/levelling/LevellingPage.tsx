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
  isFinalStep,
  levellingReducer,
  toPayload,
  totalSteps,
  type LevellingMode,
  type LevellingState,
} from './levellingFlow'
import { QUESTIONS } from './levellingQuestions'
import type { MyLevelling } from './levellingQueries'
import { clearDraft, readDraft, saveDraft } from './levellingDraft'
import { returnPathFrom } from './levellingRoutes'
import { useCompleteLevelling, useMyLevelling } from './useMyLevelling'
import QuestionStep from './QuestionStep'
import PlaytomicStep from './PlaytomicStep'

const SAVE_ERROR = 'We couldn’t save your answers. Please try again.'

const FINISHED: Record<LevellingMode, string> = {
  level: 'You’re all set and ready to register for an event.',
  questions: 'That helps us put you in the right games.',
}

const finishedToast = ({ name, mode }: { name: string | undefined; mode: LevellingMode }) => {
  const first = name?.split(' ')[0]
  return `${first ? `Thanks, ${first}! ` : 'Thanks! '}${FINISHED[mode]}`
}

/** Six steps for a player who needs levelling; the five questions for one who has a level. */
const modeFor = ({ needsLevelling, questionsOpen }: MyLevelling): LevellingMode | null => {
  if (needsLevelling) return 'level'
  return questionsOpen ? 'questions' : null
}

/** The levelling flow (DESIGN §2.2, §2.6). Finishing never registers. */
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
      mode={modeFor(levelling.data)}
      levelOnFile={levelling.data.levelOnFile}
    />
  )
}

function LevellingFlow({
  userId,
  from,
  mode,
  levelOnFile,
}: {
  userId: string
  from: string
  /** Null once there's nothing left to answer. */
  mode: LevellingMode | null
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
  const [state, dispatch] = useReducer(levellingReducer, undefined, (): LevellingState => {
    const draft = readDraft({ userId })
    return draft && draft.mode === mode
      ? draft
      : initialLevellingState({ levelOnFile, mode: mode ?? 'level' })
  })

  useEffect(() => {
    if (!finished.current) saveDraft({ userId, state })
  }, [userId, state])

  // The last question can push Finish below the fold; bring it up once it can be tapped.
  const finishRef = useRef<HTMLDivElement>(null)
  const ready = state.mode === 'questions' && canFinish(state)
  useEffect(() => {
    if (ready) finishRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [ready])

  if (!mode && !finished.current) return <Navigate to={from} replace />

  const close = async () => {
    const stop = await confirm({
      title: 'Stop now?',
      message: 'Your answers so far are kept.',
      confirmLabel: 'Stop',
      cancelLabel: 'Keep going',
    })
    if (stop) navigate(from, { replace: true })
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
    navigate(from, { replace: true })
    if (status !== 'not_needed') {
      showToast({
        variant: 'success',
        message: finishedToast({ name: player?.name, mode: state.mode }),
      })
    }
  }

  const final = isFinalStep(state)
  const onPlaytomicStep = state.mode === 'level' && final
  return (
    <div className="pt-5 space-y-6">
      <StepHeader
        step={state.step + 1}
        total={totalSteps(state)}
        onBack={back}
        onClose={() => void close()}
        closeLabel={state.mode === 'level' ? 'Stop setting your level' : 'Stop answering'}
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
          last={final}
          onAnswer={(code) => dispatch({ type: 'answer', key: QUESTIONS[state.step].key, code })}
        />
      )}
      {final && (
        <div ref={finishRef} className="space-y-3 scroll-mb-24">
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
