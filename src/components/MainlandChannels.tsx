import { MAINLAND_CHANNELS, sourceEntry } from '../data/originBranch'
import { useLocale } from '../i18n/react'

/**
 * 港澳臺起點進大陸高校的官方管道（批 E2；研究 origin_branch_design.md §4 實際核查）。
 * 只上 live（verified＋https＋同網域）的鏈接；needs_review 的管道只寫「官方頁本站未讀到」。要點為本站摘要（當時值），以當年辦法為準。
 */
export function MainlandChannels({ region }: { region: 'hk' | 'mo' | 'tw' }) {
  const { t } = useLocale()
  const channels = MAINLAND_CHANNELS[region]
  return (
    <section className="flex flex-col gap-3" aria-label={t('ui.channels.title')} data-mainland-channels={region}>
      <div className="flex flex-col gap-1">
        <h2 className="serif text-2xl">{t('ui.channels.title')} <span className="text-fog-500 text-base">· {channels.length}</span></h2>
        <p className="text-xs text-fog-500 leading-relaxed">{t('ui.channels.note')}</p>
      </div>
      <ul className="flex flex-col gap-3">
        {channels.map((channel) => {
          const sources = channel.sources.map((url) => ({ url, entry: sourceEntry(url) })).filter((s) => s.entry)
          return (
            <li key={channel.id} className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-4 flex flex-col gap-2">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <h3 className="text-base text-fog-100 font-semibold leading-snug">{t(`ui.channels.${channel.key}.title`)}</h3>
                <span className="inline-block rounded-full border border-ink-700 bg-ink-950 px-2.5 py-0.5 text-xs text-fog-300 leading-5 shrink-0">
                  {channel.status === 'verified' ? t('ui.channels.statusVerified') : t('ui.channels.statusUnread')}
                </span>
              </div>
              <p className="text-sm text-fog-300 leading-relaxed">{t(`ui.channels.${channel.key}.summary`)}</p>
              {sources.length > 0 && (
                <p className="text-xs mono text-fog-500 break-words leading-relaxed">
                  {t('ui.channels.sources')}
                  {sources.map(({ url, entry }, index) => (
                    <span key={url}>
                      {index > 0 && ' · '}
                      {entry!.live
                        ? <a className="underline hover:text-accent-500" href={url} target="_blank" rel="noreferrer noopener">{entry!.title || entry!.domain} ↗</a>
                        : <span>{t('ui.branch.sourceUnread', { title: entry!.title || entry!.domain, domain: entry!.domain, reason: entry!.reason || entry!.status })}</span>}
                      {' '}<span>{t('ui.overseas.checked', { date: entry!.fetchedAt })}</span>
                    </span>
                  ))}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
