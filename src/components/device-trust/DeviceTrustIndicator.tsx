export interface DeviceTrustIndicatorProps {
  visible: boolean
}

export default function DeviceTrustIndicator({ visible }: DeviceTrustIndicatorProps) {
  if (!visible) return null
  return (
    <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide text-lob-amber bg-lob-amber/20 rounded-full">
      Read-only device
    </span>
  )
}
