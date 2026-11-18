import { OptionRow } from '../../components/ui/OptionRow'
import type { QUESTIONS } from './levellingQuestions'

interface QuestionStepProps {
  question: (typeof QUESTIONS)[number]
  answer: string | undefined
  /** The flow's last step: tapping records the answer and Finish sends it. */
  last?: boolean
  onAnswer: (code: string) => void
}

/** One question; tapping an answer records it and moves on. */
export default function QuestionStep({
  question,
  answer,
  last = false,
  onAnswer,
}: QuestionStepProps) {
  return (
    <section className="space-y-4" aria-labelledby="levelling-question">
      <div className="space-y-1">
        <h2 id="levelling-question" className="text-xl font-bold text-lob-dark leading-snug">
          {question.title}
        </h2>
        {question.hint && <p className="text-sm text-lob-slate">{question.hint}</p>}
      </div>
      <div className="space-y-2">
        {question.options.map(({ code, label }) => (
          <OptionRow
            key={code}
            title={label}
            selected={answer === code}
            onClick={() => onAnswer(code)}
          />
        ))}
      </div>
      <p className="caption text-center">
        {last ? 'Pick an answer, then Finish' : 'Tap an answer to continue'}
      </p>
    </section>
  )
}
