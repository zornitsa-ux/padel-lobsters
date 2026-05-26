interface Tab {
  id: string
  label: string
}

interface TabSwitcherProps {
  tabs: Tab[]
  value: string
  onChange: (id: string) => void
  className?: string
}

export function TabSwitcher({ tabs, value, onChange, className }: TabSwitcherProps) {
  return (
    <div className={`flex gap-1 bg-gray-100 p-1 rounded-xl ${className ?? ''}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`flex-1 py-1.5 px-3 rounded-lg text-sm font-semibold transition-colors ${
            value === tab.id
              ? 'bg-white text-lob-teal shadow-sm'
              : 'text-gray-500 hover:text-lob-dark'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
