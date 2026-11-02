import React, { useRef } from 'react'
import { PageHeader } from '../../components/ui/PageHeader'
import { ListCard, ListRow } from '../../components/ui/ListCard'
import { Section } from '../../components/ui/Section'
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
      <p className="text-sm text-lob-slate leading-relaxed">{item.a}</p>

      {item.list && (
        <ul className="space-y-1.5">
          {item.list.map((entry, i) => (
            <li key={i} className="text-sm text-lob-slate leading-relaxed flex gap-2">
              {entry.emoji && <span className="flex-shrink-0">{entry.emoji}</span>}
              <span>
                {entry.label && (
                  <span className="font-semibold text-lob-dark">{entry.label}: </span>
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
            <li key={i} className="text-sm text-lob-slate leading-relaxed">
              <span className="font-semibold text-lob-dark">{step.title}</span> {step.text}
              {step.image && (
                <img
                  src={step.image}
                  alt={step.title}
                  loading="lazy"
                  className="mt-2 w-full rounded-xl border border-lob-line"
                />
              )}
            </li>
          ))}
        </ol>
      )}

      {item.note && <p className="text-sm text-lob-slate leading-relaxed">{item.note}</p>}
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
        tabs={content.map((section) => ({
          label: `${section.chipEmoji} ${section.label}`,
          onClick: () => scrollToSection(section.slug),
        }))}
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
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none eyebrow-accent marker:content-none">
                  {section.label}
                  <span className="text-lob-teal text-xs flex-shrink-0 transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>
                <p className="text-sm text-lob-dark leading-relaxed italic mt-2">{section.story}</p>
              </details>
            ) : (
              <Section title={section.label}>
                <ListCard>
                  {(section.items ?? []).map((item) => (
                    <ListRow key={item.q}>
                      <details name={ACCORDION_GROUP} className="group">
                        <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm font-semibold text-lob-dark marker:content-none">
                          {item.q}
                          <span className="text-lob-muted-light text-xs flex-shrink-0 transition-transform group-open:rotate-180">
                            ▾
                          </span>
                        </summary>
                        <AnswerBody item={item} />
                      </details>
                    </ListRow>
                  ))}
                </ListCard>
              </Section>
            )}
          </div>
        ))}

        <p className="text-xs text-lob-muted-light text-center pt-2">
          Question not here? Ask in the Padel Lobsters WhatsApp group.
        </p>
      </div>
    </div>
  )
}
