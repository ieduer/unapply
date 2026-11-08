import type { OriginRegion } from '../data/origins'
import {
  DESTINATIONS,
  QUALIFICATIONS_BY_ORIGIN,
  QUALIFICATION_OPTIONS,
  liveSourceLinks,
  type Destination,
  type OriginPrefs,
  type Qualification,
} from '../data/originBranch'
import { useLocale } from '../i18n/react'

interface Props {
  origin: OriginRegion
  prefs: OriginPrefs
  onChange: (prefs: OriginPrefs) => void
}

/**
 * 起點之後的題（2026-11-08 批 G6 重做，展示層）：
 *  - 資格：只對非大陸起點出現，可跳過；只用來在海外層標示「校方頁面寫明接受」，不劃掉任何學校。
 *  - 「你考慮去哪裡讀？」：多選中國大陸／香港／澳門／臺灣／海外，至少一個；預設＝起點本地。取代批 E2 三套互不一致的範圍題。
 * 只存 localStorage（unapply.originPrefs.v2），不進 AnswerMap、不進 A+ 證據；流程由 planFlow 依目的地決定。
 */
export function OriginBranch({ origin, prefs, onChange }: Props) {
  const { t } = useLocale()
  const qualifications = QUALIFICATIONS_BY_ORIGIN[origin]
  const pick = (qualification: Qualification) => onChange({ ...prefs, qualification: prefs.qualification === qualification ? null : qualification })
  const toggleDestination = (destination: Destination) => {
    const on = prefs.destinations.includes(destination)
    if (on && prefs.destinations.length === 1) return
    const next = on ? prefs.destinations.filter((d) => d !== destination) : [...prefs.destinations, destination]
    onChange({ ...prefs, destinations: DESTINATIONS.filter((d) => next.includes(d)) })
  }
  const chosen = prefs.qualification ? QUALIFICATION_OPTIONS[prefs.qualification] : null
  const links = chosen ? liveSourceLinks(chosen.sources) : []
  return (
    <div className="border border-ink-800 bg-ink-950/60 rounded-xl p-4 flex flex-col gap-5" data-origin-branch={origin}>
      {qualifications.length > 0 && (
        <fieldset className="flex flex-col gap-2" data-branch-question="qualification">
          <legend className="serif text-lg mb-2">{t('ui.branch.qualTitle')}</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {qualifications.map((qualification) => {
              const active = prefs.qualification === qualification
              return (
                <button
                  key={qualification}
                  type="button"
                  onClick={() => pick(qualification)}
                  aria-pressed={active}
                  data-branch-qualification={qualification}
                  className={[
                    'text-left rounded-xl border px-3 py-3 min-h-[56px] flex flex-col gap-1',
                    active ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-900 text-fog-300 hover:border-fog-500 hover:text-fog-100',
                  ].join(' ')}
                >
                  <span className="serif text-base leading-snug">{t(`origin.qual.${qualification}.label`)}</span>
                  <span className="text-xs text-fog-500 leading-snug">{t(`origin.qual.${qualification}.hint`)}</span>
                </button>
              )
            })}
            <SkipButton active={prefs.qualification === null} onClick={() => onChange({ ...prefs, qualification: null })} label={t('ui.branch.skip')} />
          </div>
          {links.length > 0 && (
            <p className="text-xs mono text-fog-500 leading-relaxed flex flex-wrap items-center gap-x-2" data-branch-sources>
              <span>{t('ui.branch.officialInfo')}</span>
              {links.map(({ url, org }, index) => (
                <span key={url} className="inline-flex items-center gap-x-2">
                  {index > 0 && <span aria-hidden="true">·</span>}
                  <a className="inline-flex items-center min-h-[40px] underline hover:text-accent-500" href={url} target="_blank" rel="noreferrer noopener">{t(`ui.source.${org}`)} ↗</a>
                </span>
              ))}
            </p>
          )}
        </fieldset>
      )}

      <fieldset className="flex flex-col gap-2" data-branch-question="destinations">
        <legend className="serif text-lg mb-2">{t('ui.branch.destTitle')}</legend>
        <div className="flex flex-wrap gap-2">
          {DESTINATIONS.map((destination) => {
            const active = prefs.destinations.includes(destination)
            const last = active && prefs.destinations.length === 1
            return (
              <button
                key={destination}
                type="button"
                onClick={() => toggleDestination(destination)}
                aria-pressed={active}
                aria-label={last ? t('ui.branch.destLastAria', { place: t(`ui.dest.${destination}`) }) : t(`ui.dest.${destination}`)}
                data-branch-destination={destination}
                className={[
                  'px-4 min-h-[44px] rounded-full border text-sm inline-flex items-center gap-2',
                  active ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-900 text-fog-300 hover:border-fog-500 hover:text-fog-100',
                ].join(' ')}
              >
                <span aria-hidden="true" className="mono text-xs">{active ? '✓' : '+'}</span>
                {t(`ui.dest.${destination}`)}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-fog-500 leading-relaxed">{t('ui.branch.destNote')}</p>
      </fieldset>
    </div>
  )
}

/** 「跳過」：選中即未答（null）；未答時顯示為選中。 */
function SkipButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-branch-skip
      className={[
        'px-4 min-h-[44px] rounded-full border text-sm justify-self-start',
        active ? 'border-fog-500 bg-ink-800 text-fog-100' : 'border-ink-700 bg-ink-900 text-fog-300 hover:border-fog-500 hover:text-fog-100',
      ].join(' ')}
    >
      {label}
    </button>
  )
}
