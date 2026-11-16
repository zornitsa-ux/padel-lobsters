import { useId } from 'react'
import { OptionRow } from '../../components/ui/OptionRow'
import { Well } from '../../components/ui/Well'
import { FormError } from '../../components/ui/FormError'
import { useFieldError } from '../../components/ui/useFieldError'
import { playtomicProblem, type LevellingState, type PlaytomicChoice } from './levellingFlow'

interface PlaytomicStepProps {
  playtomic: LevellingState['playtomic']
  prefilled: boolean
  onChoose: (choice: Exclude<PlaytomicChoice, null>) => void
  onType: (text: string) => void
}

const COPY = {
  fresh: {
    title: 'Do you have a Playtomic level?',
    hint: 'No problem if you don’t. Many new Lobsters haven’t played on Playtomic yet.',
    no: 'No, or I’m not sure',
  },
  prefilled: {
    title: 'Is this still your Playtomic level?',
    hint: 'From your profile. Change it if it’s moved.',
    no: 'I don’t have one',
  },
}

/** The last step: a Playtomic level, or none. The only step with a submit button. */
export default function PlaytomicStep({
  playtomic,
  prefilled,
  onChoose,
  onType,
}: PlaytomicStepProps) {
  const copy = prefilled ? COPY.prefilled : COPY.fresh
  return (
    <section className="space-y-4" aria-labelledby="levelling-question">
      <div className="space-y-1">
        <h2 id="levelling-question" className="text-xl font-bold text-lob-dark leading-snug">
          {copy.title}
        </h2>
        <p className="text-sm text-lob-slate">{copy.hint}</p>
      </div>
      <div className="space-y-2">
        <OptionRow
          title="Yes"
          selected={playtomic.choice === 'yes'}
          onClick={() => onChoose('yes')}
        />
        {playtomic.choice === 'yes' && <LevelField text={playtomic.text} onType={onType} />}
        <OptionRow
          title={copy.no}
          selected={playtomic.choice === 'no'}
          onClick={() => onChoose('no')}
        />
      </div>
    </section>
  )
}

function LevelField({ text, onType }: { text: string; onType: (text: string) => void }) {
  const inputId = useId()
  // Blank is covered by the disabled Finish button; only a typed mistake is called out.
  const problem = text.trim() ? playtomicProblem({ text }) : ''
  const { errorId, fieldProps } = useFieldError({ message: problem })
  return (
    <Well>
      <label className="label" htmlFor={inputId}>
        Your Playtomic level (0–7)
      </label>
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        className="input"
        placeholder="e.g. 2.5"
        value={text}
        onChange={(e) => onType(e.target.value)}
        {...fieldProps}
      />
      <FormError id={errorId} message={problem} polite />
      <p className="caption">Open the Playtomic app: it’s on your profile.</p>
    </Well>
  )
}
