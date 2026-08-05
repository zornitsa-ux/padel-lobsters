import React, { useRef } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { useSettings } from '../settings/useSettings'
import { resolveLobsterWayContent, type LobsterWayItem } from '../../data/lobsterWayContent'

// "The Lobster Way" — the app's single FAQ/help destination. All three entry
// points (header icon, home teaser card, Account menu row) route here.
//
// Every <details> on the page (including the Origin story) shares
// name="lobster-way", so opening one automatically closes whichever other
// one was open — a native HTML exclusive-accordion group, no state needed.
const ACCORDION_GROUP = 'lobster-way'

function AnswerBody({ item }: { item: LobsterWayItem }) {
  return (
    <div className="mt-2 space-y-2">
      <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>

      {item.list && (
        <ul className="space-y-1.5">
          {item.list.map((entry, i) => (
            <li key={i} className="text-sm text-gray-600 leading-relaxed flex gap-2">
              {entry.emoji && <span className="flex-shrink-0">{entry.emoji}</span>}
              <span>
                {entry.label && (
                  <span className="font-semibold text-gray-700">{entry.label}: </span>
                )}
                {entry.text}
              </span>
            </li>
          ))}
        </ul>
      )}

      {item.steps && (
        <ol className="space-y-3 list-decimal list-inside">
          {item.steps.map((step, i) => (
            <li key={i} className="text-sm text-gray-600 leading-relaxed">
              <span className="font-semibold text-gray-700">{step.title}</span> {step.text}
              {step.image && (
                <img
                  src={step.image}
                  alt={step.title}
                  loading="lazy"
                  className="mt-2 w-full rounded-xl border border-gray-100"
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {item.note && <p className="text-sm text-gray-600 leading-relaxed">{item.note}</p>}
    </div>
  )
}

export default function LobsterWay() {
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const { data: settings } = useSettings()
  const content = resolveLobsterWayContent(settings)

  const scrollToSection = (slug: string) => {
    sectionRefs.current[slug]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="-mx-4">
      <PageHeader
        title="The Lobster way"
        eyebrow="Help & FAQ"
        backLink={{ to: '/account', label: 'Account' }}
        tabStrip={
          <div className="flex gap-1.5">
            {content.map((section) => (
              <button
                key={section.slug}
                type="button"
                onClick={() => scrollToSection(section.slug)}
                className="px-3.5 py-1.5 text-sm font-semibold rounded-full whitespace-nowrap text-lob-teal hover:bg-white/60 transition-colors"
              >
                {section.chipEmoji} {section.label}
              </button>
            ))}
          </div>
        }
      />

      <div className="px-4 pt-4 pb-8 space-y-5">
        {content.map((section) => (
          <div
            key={section.slug}
            ref={(el) => {
              sectionRefs.current[section.slug] = el
            }}
            className="scroll-mt-4"
          >
            {section.isStory ? (
              <details
                name={ACCORDION_GROUP}
                className="group bg-lob-cream border border-lob-teal/20 rounded-2xl px-4 py-3"
              >
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-[11px] font-bold text-lob-teal uppercase tracking-wide marker:content-none">
                  {section.label}
                  <span className="text-lob-teal text-xs flex-shrink-0 transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <p className="text-sm text-gray-700 leading-relaxed italic mt-2">{section.story}</p>
              </details>
            ) : (
              <div className="card space-y-2">
                <h2 className="font-bold text-gray-700 text-sm">{section.label}</h2>
                <div className="divide-y divide-gray-100">
                  {(section.items ?? []).map((item) => (
                    <details
                      key={item.q}
                      name={ACCORDION_GROUP}
                      className="group py-2.5 first:pt-0 last:pb-0"
                    >
                      <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm font-semibold text-gray-800 marker:content-none">
                        {item.q}
                        <span className="text-gray-400 text-xs flex-shrink-0 transition-transform group-open:rotate-180">
                          ▾
                        </span>
                      </summary>
                      <AnswerBody item={item} />
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        <p className="text-xs text-gray-400 text-center pt-2">
          Question not here? Ask in the Padel Lobsters WhatsApp group.
        </p>
      </div>
    </div>
  )
}
