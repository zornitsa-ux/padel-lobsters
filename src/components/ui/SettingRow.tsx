import type { ReactNode } from 'react'

interface SettingRowProps {
  /** What the setting is: Email, Password. */
  label: ReactNode
  /** Its current value or a line on what it does, under the label. */
  value?: ReactNode
  /** The control that changes it, at the end of the row. */
  action?: ReactNode
  /** Content under the row, such as the open edit form. */
  children?: ReactNode
}

/** One setting in a settings `ListCard`: label and value on the left, its control on the right. */
export function SettingRow({ label, value, action, children }: SettingRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-lob-dark">{label}</p>
          {value && <div className="caption mt-0.5">{value}</div>}
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  )
}
