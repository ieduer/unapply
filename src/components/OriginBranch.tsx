import type { OriginRegion } from '../data/origins'
import {
  MAINLAND_ORIGIN_SOURCES,
  QUALIFICATIONS_BY_ORIGIN,
  QUALIFICATION_OPTIONS,
  SCOPES_BY_ORIGIN,
  scopeGroup,
  sourceEntry,
  type OriginPrefs,
  type Qualification,
  type Scope,
} from '../data/originBranch'
import { useLocale } from '../i18n/react'

interface Props {
  origin: OriginRegion
  prefs: OriginPrefs
  onChange: (prefs: OriginPrefs) => void
}

/**
 * 起點分支（批 E2，展示層）：各起點的「前幾題」——資格（港澳臺／海外起點）與範圍（所有起點）。皆可跳過（2026-11-08 批 G5：每題末尾一個「跳過」選項，選中＝未答）；
 * 只存 localStorage（unapply.originPrefs.v1），不進 AnswerMap、不進 A+ 證據。資格只用來在海外層標示「校方頁面寫明接受」，不劃掉任何學校。
 */
export function OriginBranch({ origin, prefs, onChange }: Props) {
  const { t } = useLocale()
  const qualifications = QUALIFICATIONS_BY_ORIGIN[origin]
  const scopes = SCOPES_BY_ORIGIN[origin]
  const group = scopeGroup(origin)
  const pick = (qualification: Qualification) => onChange({ ...prefs, qualification: prefs.qualification === qualification ? null : qualification })
  const pickScope = (scope: Scope) => onChange({ ...prefs, scope: prefs.scope === scope ? null : scope })
  const chosen = prefs.qualification ? QUALIFICATION_OPTIONS[prefs.qualification] : null
  const sources = chosen ? chosen.sources : origin === 'cn-mainland' ? MAINLAND_ORIGIN_SOURCES : []
  return (
    <div className="border border-ink-800 bg-ink-950/60 rounded-xl p-4 flex flex-col gap-4" data-origin-branch={origin}>
      {qualifications.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="serif text-lg">{t('ui.branch.qualTitle')}</h3>
          <div className="grid gap-2 sm:grid-cols-2" role="group" aria-label={t('ui.branch.qualTitle')}>
            {qualifications.map((qualification) => {
              const active = prefs.qualification === qualification
              return (
                <button
                  key={qualification}
                  type="button"
                  onClick={() => pick(qualification)}
                  aria-pressed={active}
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
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="serif text-lg">{t(`ui.branch.scopeTitle.${group}`)}</h3>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t(`ui.branch.scopeTitle.${group}`)}>
          {scopes.map((scope) => {
            const active = prefs.scope === scope
            return (
              <button
                key={scope}
                type="button"
                onClick={() => pickScope(scope)}
                aria-pressed={active}
                className={[
                  'px-4 min-h-[44px] rounded-full border text-sm',
                  active ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-900 text-fog-300 hover:border-fog-500 hover:text-fog-100',
                ].join(' ')}
              >
                {t(`origin.scope.${group}.${scope}`)}
              </button>
            )
          })}
          <SkipButton active={prefs.scope === null} onClick={() => onChange({ ...prefs, scope: null })} label={t('ui.branch.skip')} />
        </div>
      </div>

      {sources.length > 0 && (
        <p className="text-xs mono text-fog-500 leading-relaxed break-words">
          {t('ui.branch.sources')}
          {sources.map((url, index) => {
            const entry = sourceEntry(url)
            if (!entry) return null
            return (
              <span key={url}>
                {index > 0 && ' · '}
                {entry.live
                  ? <a className="underline hover:text-accent-500" href={url} target="_blank" rel="noreferrer noopener">{entry.title || entry.domain} ↗</a>
                  : <span>{t('ui.branch.sourceUnread', { title: entry.title || entry.domain, domain: entry.domain, reason: entry.reason || entry.status })}</span>}
              </span>
            )
          })}
        </p>
      )}

      <p className="text-xs text-fog-500 leading-relaxed">{t('ui.branch.note')}</p>
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
