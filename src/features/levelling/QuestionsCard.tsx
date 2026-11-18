import LevellingPrompt from './LevellingPrompt'

/**
 * Home prompt for a player who has a level: the five questions, no Playtomic step (S3c).
 * Never a gate; render it only when `useQuestionsPrompt` says it's open.
 */
export default function QuestionsCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <LevellingPrompt
      title="We’re getting to know you better"
      body="We’ve improved how we match players. Five quick questions help us put you in the right games."
      action="Answer 5 questions"
      note="About a minute · Only once"
      accent
      onDismiss={onDismiss}
      testId="questions-card"
    />
  )
}
