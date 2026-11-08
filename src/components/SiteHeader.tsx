import { type ReactNode } from 'react'
import { ThemeCustomizer } from '../shared-ui/ThemeCustomizer'
import { useLocale } from '../i18n/react'
import { LocaleSwitcher } from './LocaleSwitcher'

export interface SiteHeaderAction {
  label: ReactNode
  onClick: () => void
  /** 只在 ≥640px 顯示（窄螢幕收起次要動作）。 */
  wideOnly?: boolean
}

interface Props {
  /** 寬螢幕顯示的站名／頁名（含版本號）；窄螢幕一律縮為「nope」。 */
  brand: ReactNode
  /** 左側返回／回首頁。 */
  back?: SiteHeaderAction
  /** 中間的進度之類資訊（問卷頁）；只在 ≥640px 放在頁頭這一行（窄螢幕由頁面自己放到頁頭下方）。 */
  center?: ReactNode
  /** 右側動作（about、貢獻、跳過…）。 */
  actions?: SiteHeaderAction[]
  sticky?: boolean
  /** 內容寬度，對齊各頁主欄。 */
  width?: 'max-w-2xl' | 'max-w-3xl' | 'max-w-5xl'
  /** 頁頭底部附加（問卷進度條）。 */
  footer?: ReactNode
}

const actionClass = 'inline-flex items-center min-h-[44px] px-2 whitespace-nowrap hover:text-accent-500 transition-colors'

/**
 * 全站共用頁頭（2026-11-08 批 G3 後續：修右上角色系浮鈕與頁頭重疊、手機版面）。
 * 一行：返回 · 站名 · 中間資訊 ·（彈性空白）· 色系（inline）· 動作 · 語言切換；
 * 放不下時只有最後的語言切換換到第二行（flex-wrap 從尾端換行），控制項之間不重疊。
 * 窄螢幕（<640px）站名縮為「nope」、版本號隱藏、語言切換不折行。
 */
export function SiteHeader({ brand, back, center, actions = [], sticky = false, width = 'max-w-5xl', footer }: Props) {
  const { t } = useLocale()
  const themeLabels = {
    title: t('ui.theme.title'),
    close: t('ui.common.close'),
    sample: t('ui.theme.text'),
    presets: {
      paper: { label: t('ui.theme.paper.label'), description: t('ui.theme.paper.hint') },
      ink: { label: t('ui.theme.ink.label'), description: t('ui.theme.ink.hint') },
    },
  }
  return (
    <header
      data-site-header
      className={[
        sticky ? 'sticky top-0' : 'relative',
        'z-40 w-full border-b border-ink-800 bg-ink-950/90 backdrop-blur',
      ].join(' ')}
    >
      <div className={[width, 'mx-auto px-3 sm:px-6 py-2 sm:py-3 flex flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 text-xs mono uppercase tracking-[0.16em] sm:tracking-[0.2em] text-fog-500'].join(' ')}>
        {back && (
          <button type="button" onClick={back.onClick} className={actionClass} data-site-header-back>
            {back.label}
          </button>
        )}
        <span className="inline-flex items-center min-h-[44px] whitespace-nowrap" data-site-header-brand>
          <span className="sm:hidden">nope</span>
          <span className="hidden sm:inline">{brand}</span>
        </span>
        {center && <span className="max-sm:hidden inline-flex items-center min-h-[44px] whitespace-nowrap normal-case tracking-normal">{center}</span>}
        <span className="flex-1 min-w-0" aria-hidden="true" />
        <ThemeCustomizer placement="inline" labels={themeLabels} />
        {actions.map((action, index) => (
          <button key={index} type="button" onClick={action.onClick} className={[actionClass, action.wideOnly ? 'max-sm:hidden' : ''].join(' ')}>
            {action.label}
          </button>
        ))}
        <LocaleSwitcher className="ml-auto" />
      </div>
      {footer}
    </header>
  )
}
