// D-028. Tied climbers share one start and gain, so one detail describes them all.
export default function BiggestClimberLine({
  labels,
  detail,
}: {
  labels: string[]
  detail: string
}) {
  return (
    <>
      🚀 {labels.length > 1 ? 'Biggest climbers' : 'Biggest climber'}:{' '}
      <span className="font-bold">{labels.join(', ')}</span> ({detail})
    </>
  )
}
