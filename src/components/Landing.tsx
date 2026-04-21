import {
  officialSchoolCount,
  officialUndergraduateCount,
  officialVocationalCount,
} from '../data/schoolCatalogSummary'

interface Props {
  onStart: () => void
  onAbout: () => void
}

export function Landing({ onStart, onAbout }: Props) {
  return (
    <main className="min-h-screen app-canvas text-fog-100 flex flex-col items-center justify-between px-5 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-2xl flex items-center justify-between text-[10px] sm:text-xs mono uppercase tracking-[0.2em] sm:tracking-[0.25em] text-fog-500">
        <span>nope.bdfz.net · v1.4</span>
        <button
          onClick={onAbout}
          className="hover:text-accent-500 transition-colors min-h-[44px] -my-3 py-3 px-2"
        >
          about
        </button>
      </div>

      <section className="w-full max-w-2xl flex flex-col gap-8 sm:gap-12 py-10">
        <h1 className="serif text-4xl sm:text-6xl leading-tight">
          <span className="block text-fog-500 text-lg sm:text-2xl tracking-wider mb-4 sm:mb-6">減法人生 · 學校版</span>
          你一定<span className="text-accent-500">不考</span>
          <br />哪所大學
        </h1>

        <p className="text-base sm:text-lg text-fog-300 leading-relaxed max-w-xl">
          這裡不告訴你「該考哪所」。<br />
          只陪你從教育部 2025 名單的 <span className="mono text-fog-100">{officialSchoolCount.toLocaleString()}</span> 所
          中，用你自己的不能忍，劃掉一批。
        </p>

        <div className="flex flex-col gap-2 text-sm text-fog-500 leading-relaxed">
          <p className="mono">
            本次目錄 / {officialSchoolCount.toLocaleString()} 所普通高校（本科 {officialUndergraduateCount.toLocaleString()} · 高職專科 {officialVocationalCount.toLocaleString()}）
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <button
            onClick={onStart}
            className="px-7 py-4 sm:py-3 bg-accent-500 text-ink-950 rounded-full font-semibold text-base hover:bg-accent-400 transition-colors min-h-[52px]"
          >
            開始減法 →
          </button>
          <span className="text-xs mono text-fog-500">按當前有效數據動態出題 · 可隨時跳過</span>
        </div>
      </section>

      <footer className="w-full max-w-2xl text-xs mono text-fog-500 leading-relaxed space-y-2 pt-6 border-t border-ink-800">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-fog-300">姊妹站：</span>
          <a className="hover:text-accent-500" href="https://path.bdfz.net" target="_blank" rel="noreferrer noopener">path · 職業減法</a>
          <span className="text-ink-700">·</span>
          <a className="hover:text-accent-500" href="https://750.bdfz.net" target="_blank" rel="noreferrer noopener">750 · 北京高考</a>
          <span className="text-ink-700">·</span>
          <a className="hover:text-accent-500" href="https://my.bdfz.net" target="_blank" rel="noreferrer noopener">my · 用戶中心</a>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-fog-300">權威數據：</span>
          <a className="hover:text-accent-500" href="https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html" target="_blank" rel="noreferrer noopener">教育部</a>
          <span className="text-ink-700">·</span>
          <a className="hover:text-accent-500" href="https://www.cma.gov.cn/" target="_blank" rel="noreferrer noopener">氣象局</a>
          <span className="text-ink-700">·</span>
          <a className="hover:text-accent-500" href="https://www.yicai.com/topic/100311963/" target="_blank" rel="noreferrer noopener">第一財經</a>
          <span className="text-ink-700">·</span>
          <a className="hover:text-accent-500" href="https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/" target="_blank" rel="noreferrer noopener">學科評估</a>
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="text-fog-300">開源 & 貢獻：</span>
          <a className="hover:text-accent-500" href="https://github.com/ieduer/unapply" target="_blank" rel="noreferrer noopener">ieduer/unapply</a>
          <span className="text-ink-700">·</span>
          <a className="hover:text-accent-500" href="https://github.com/CollegesChat/university-information" target="_blank" rel="noreferrer noopener">CollegesChat</a>
        </div>
        <div className="opacity-70 pt-1">非商業公益 · CC BY-NC-SA 4.0 · 不提供志願填報建議</div>
      </footer>
    </main>
  )
}
