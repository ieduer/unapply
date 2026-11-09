import { MAINLAND_CHANNELS, liveSourceLinks } from '../data/originBranch'
import { useLocale } from '../i18n/react'

/**
 * 港澳臺起點進大陸高校的官方管道（批 E2；研究 origin_branch_design.md §4 實際核查）。
 * 2026-11-08 批 G6：不再顯示內部核查狀態；來源行只上 live（verified＋https＋同網域）的鏈接，鏈接文字用機構名，
 * 沒有可上的鏈接時來源行寫一次「官方頁本站未讀到」。要點為本站摘要（當時值），以當年辦法為準。
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
          const links = liveSourceLinks(channel.sources)
          return (
            <li key={channel.id} className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-panel p-4 flex flex-col gap-2">
              <h3 className="text-base text-fog-100 font-semibold leading-snug">{t(`ui.channels.${channel.key}.title`)}</h3>
              <p className="text-sm text-fog-300 leading-relaxed">{t(`ui.channels.${channel.key}.summary`)}</p>
              <p className="text-xs mono text-fog-500 break-words leading-relaxed flex flex-wrap items-center gap-x-2">
                <span>{t('ui.branch.officialInfo')}</span>
                {links.length > 0
                  ? links.map(({ url, org }) => <a key={url} className="inline-flex items-center min-h-[40px] underline hover:text-accent-500" href={url} target="_blank" rel="noreferrer noopener">{t(`ui.source.${org}`)} ↗</a>)
                  : <span>{t('ui.overseas.unreadPrefix')}</span>}
              </p>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
