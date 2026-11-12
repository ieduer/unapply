import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useLocale } from '../i18n/react'

// 頁面載入失敗的保護（批 H2）：懶載 chunk 在慢網路或斷線時可能載不下來，沒有這一層 React 會把整個畫面卸掉（空白頁）。
// 這裡接住錯誤，顯示可讀的說明，給「重新載入頁面」與「返回首頁」。換路由時自動復位。

function PageLoadFailed({ onReload, onHome }: { onReload: () => void; onHome: () => void }) {
  const { t } = useLocale()
  return (
    <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5" data-page-error="">
      <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-panel p-6 flex flex-col gap-4">
        <h1 className="serif text-2xl">{t('ui.app.pageLoadFailed')}</h1>
        <p className="text-sm text-fog-500 leading-relaxed" role="alert">{t('ui.data.error.network')}</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onReload}
            className="px-5 py-3 min-h-[44px] rounded-ctl bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400"
          >
            {t('ui.common.reloadPage')}
          </button>
          <button
            onClick={onHome}
            className="px-5 py-3 min-h-[44px] rounded-ctl border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500"
          >
            {t('ui.common.backHome')}
          </button>
        </div>
      </section>
    </main>
  )
}

interface Props {
  /** 路由鍵：變了就清掉錯誤狀態，讓使用者能去別的頁面。 */
  resetKey: string
  onHome: () => void
  children: ReactNode
}

interface State {
  failed: boolean
  /** 出錯當下的路由鍵（出錯後第一次渲染時記下）。 */
  failedKey: string | null
}

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { failed: false, failedKey: null }

  static getDerivedStateFromError(): Partial<State> {
    return { failed: true }
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (!state.failed) return null
    if (state.failedKey === null) return { failedKey: props.resetKey }
    return state.failedKey !== props.resetKey ? { failed: false, failedKey: null } : null
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    // 留在主控台供排查；不外送
    console.error('page failed to render', error, info.componentStack)
  }

  render() {
    if (this.state.failed) {
      return <PageLoadFailed onReload={() => window.location.reload()} onHome={this.props.onHome} />
    }
    return this.props.children
  }
}
