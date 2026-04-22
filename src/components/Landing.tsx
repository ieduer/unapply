import {
  officialSchoolCount,
  officialUndergraduateCount,
  officialVocationalCount,
} from '../data/schoolCatalogSummary'
import { contributionHighlights, researchSummary } from '../data/researchSummary'

interface Props {
  onStart: () => void
  onAbout: () => void
  onContribute: () => void
}

export function Landing({ onStart, onAbout, onContribute }: Props) {
  return (
    <main className="min-h-screen app-canvas text-fog-100 flex flex-col items-center justify-between px-5 sm:px-6 py-8 sm:py-12">
      <div className="w-full max-w-2xl flex items-center justify-between text-[10px] sm:text-xs mono uppercase tracking-[0.2em] sm:tracking-[0.25em] text-fog-500">
        <span>nope.bdfz.net · v1.6</span>
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

        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard
            label="眾包覆蓋學校"
            value={researchSummary.crowdMatchedSchools.toLocaleString()}
            detail="已有宿舍、假期、門禁等真實校園數據"
          />
          <MetricCard
            label="已入庫生活值"
            value={researchSummary.crowdValuesAccepted.toLocaleString()}
            detail="CollegesChat 與後續 GitHub 審核貢獻會一起累積"
          />
          <MetricCard
            label="省級權威入口"
            value={researchSummary.provincePortals.toLocaleString()}
            detail="結果頁可直達各省官方錄取/分數線查詢"
          />
        </div>

        <div className="rounded-2xl border border-ink-800 bg-ink-900/80 p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="mono text-[11px] uppercase tracking-[0.24em] text-fog-500">用戶貢獻數據</p>
            <h2 className="serif text-2xl">這個站靠大家把學校補準</h2>
            <p className="text-sm text-fog-400 leading-relaxed">
              現在首頁就把真實校園數據放進來了。你熟悉哪所學校，就補哪一塊；提交先進 GitHub issue，審核後再入庫。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {contributionHighlights.map((item) => (
              <span key={item} className="rounded-full border border-ink-700 bg-ink-950 px-3 py-1 text-xs text-fog-300">
                {item}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onContribute}
              className="px-5 py-3 rounded-full border border-accent-500/40 bg-accent-500/10 text-accent-400 text-sm hover:bg-accent-500/15 min-h-[48px]"
            >
              去補我熟悉的學校
            </button>
            <a
              className="text-xs mono text-fog-500 hover:text-accent-500"
              href="https://github.com/ieduer/unapply/issues?q=is%3Aissue+label%3Adata-contribution"
              target="_blank"
              rel="noreferrer noopener"
            >
              查看審核中的貢獻 ↗
            </a>
          </div>
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

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-900/80 p-4 flex flex-col gap-2">
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-fog-500">{label}</p>
      <p className="serif text-3xl text-fog-100">{value}</p>
      <p className="text-xs text-fog-500 leading-relaxed">{detail}</p>
    </div>
  )
}
