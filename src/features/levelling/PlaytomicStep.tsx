import { OptionRow } from '../../components/ui/OptionRow'
import { LevelInput } from '../../components/ui/LevelInput'
import { typedLevelProblem } from '../../lib/level'
import type { LevellingState, PlaytomicChoice } from './levellingFlow'

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
  return (
    <LevelInput
      label="Your Playtomic level (0–7)"
      value={text}
      onChange={onType}
      // Blank is covered by the disabled Finish button; only a typed mistake is called out.
      error={typedLevelProblem({ value: text, policy: 'required' })}
      hint="Open the Playtomic app: it’s on your profile."
      live
      inset
    />
  )
}
