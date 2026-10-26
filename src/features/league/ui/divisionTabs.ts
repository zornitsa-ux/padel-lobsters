import type { PageHeaderTab } from '../../../components/ui/PageHeader'
import { DIVISION_LABELS } from '../domain/types'
import type { Division } from '../domain/types'

/** PageHeader tabs for picking a division; none when there is only one. */
export const divisionTabs = ({
  divisions,
  value,
  onChange,
}: {
  divisions: Division[]
  value: Division
  onChange: (d: Division) => void
}): PageHeaderTab[] | undefined =>
  divisions.length > 1
    ? divisions.map((div) => ({
        label: DIVISION_LABELS[div],
        active: value === div,
        onClick: () => onChange(div),
      }))
    : undefined
