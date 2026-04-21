import { useMemo, useRef, useState } from 'react'
import type { FilterResult, AnswerMap } from '../engine/filter'
import { explainKept, suggestRelax, distribute } from '../engine/filter'
import { generateShareImage } from '../lib/share'
import { ShareCard } from './ShareCard'
import { recordUnapplyDownload } from '../lib/bdfzIdentity'

interface Props {
  result: FilterResult
  answers: AnswerMap
  onRestart: () => void
  onRelax: () => void
  onSchool: (id: string) => void
  onAbout: () => void
  onContribute: () => void
}

export function ResultPage({ result, answers, onRestart, onRelax, onSchool, onAbout, onContribute }: Props) {
  const shareRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)

  const dist = useMemo(() => distribute(result.kept), [result.kept])
  const relaxHints = useMemo(() => suggestRelax(result.stats, 3), [result.stats])
  const topKept = result.kept.slice(0, 30)

  const share = async () => {
    if (!shareRef.current) return
    setDownloading(true)
    await generateShareImage(shareRef.current, `unapply-${Date.now()}.png`)
    void recordUnapplyDownload({
      recordKind: 'download',
      recordKey: `share-${Date.now().toString(36)}`,
      title: '下載了「我的不考大學樣本」分享圖',
      summary: `劃掉 ${result.stats.excludedCount}，剩 ${result.stats.keptCount}`,
    })
    setDownloading(false)
  }

  const zero = result.kept.length === 0

  return (
    <main className="min-h-screen bg-ink-950 text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between text-xs mono uppercase tracking-[0.2em] text-fog-500">
          <span>nope · result</span>
          <div className="flex items-center gap-4">
            <button onClick={onAbout} className="hover:text-accent-500">about</button>
            <button onClick={onContribute} className="hover:text-accent-500">貢獻</button>
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-12 pb-24 flex flex-col gap-14">
        {/* 頭圖：大數字 */}
        <div className="flex flex-col gap-4">
          <p className="mono text-xs text-fog-500 uppercase tracking-[0.3em]">你的減法樣本</p>
          <h1 className="serif text-3xl sm:text-5xl leading-tight">
            從 <span className="mono text-fog-100">{result.stats.totalInput}</span> 所中，
            <br />你劃掉了 <span className="text-accent-500 mono">{result.stats.excludedCount}</span> 所。
          </h1>
          <p className="text-fog-300 text-base">
            剩 <span className="mono text-fog-100 text-lg">{result.stats.keptCount}</span> 所仍在場。
            {result.stats.answeredCount === 0 && '（還沒減任何一題，回去先減一輪？）'}
          </p>
        </div>

        {zero && (
          <div className="bg-ink-900 border border-accent-600/50 rounded-2xl p-6 flex flex-col gap-3">
            <p className="serif text-lg">全劃光了。</p>
            <p className="text-sm text-fog-300">
              你的條件目前和整個種子池都對不上。排除最多的幾題是：
              {relaxHints.map((h, i) => (
                <span key={i} className="block mt-1 text-fog-500">· {h}</span>
              ))}
            </p>
            <button
              onClick={onRelax}
              className="self-start px-5 py-2 rounded-full bg-accent-500 text-ink-950 font-semibold text-sm hover:bg-accent-400"
            >
              回去放寬幾題
            </button>
          </div>
        )}

        {/* 分佈 */}
        {!zero && (
          <div className="grid sm:grid-cols-2 gap-6">
            <DistCard title="按省份" items={dist.byProvince.slice(0, 8)} />
            <DistCard title="按層次" items={dist.byLevel} />
          </div>
        )}

        {/* 保留的學校卡片 */}
        {!zero && (
          <div className="flex flex-col gap-5">
            <div className="flex items-baseline justify-between">
              <h2 className="serif text-xl">你為什麼沒劃掉它們</h2>
              <span className="mono text-xs text-fog-500">前 {Math.min(30, topKept.length)} 所</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {topKept.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onSchool(s.id)}
                  className="text-left bg-ink-900 border border-ink-700 rounded-xl p-4 hover:border-accent-500 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="serif text-base">{s.name}</span>
                    <span className="mono text-[10px] text-fog-500 uppercase tracking-wider mt-1 shrink-0">
                      {s.cityTier === 'tier1' ? 'T1' : s.cityTier === 'newtier1' ? 'NT1' : s.cityTier === 'tier2' ? 'T2' : 'T3-'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-fog-500">{explainKept(s, answers)}</p>
                  <p className="mt-1 text-xs text-fog-500">{s.province}·{s.city}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 分享圖 & 行動 */}
        <div className="flex flex-col gap-6">
          <div ref={shareRef}>
            <ShareCard result={result} />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={share}
              disabled={downloading}
              className="px-6 py-3 bg-accent-500 text-ink-950 rounded-full font-semibold text-sm hover:bg-accent-400 disabled:opacity-50"
            >
              {downloading ? '生成中…' : '下載分享圖'}
            </button>
            <button
              onClick={onRelax}
              className="px-6 py-3 border border-fog-500 text-fog-100 rounded-full text-sm hover:border-accent-500 hover:text-accent-500"
            >
              再減一輪
            </button>
            <button
              onClick={onRestart}
              className="px-6 py-3 border border-ink-700 text-fog-500 rounded-full text-sm hover:text-fog-100"
            >
              重新開始
            </button>
          </div>
        </div>

        <footer className="mt-8 pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
          <p>本次結果基於你的個人偏好 + 公開權威名單 + 眾包問卷。</p>
          <p>數據缺失的維度不會誤殺學校（疑罪從無）。</p>
          <p>了解 <button onClick={onAbout} className="hover:text-accent-500 underline">數據來源與方法論</button> ·
            {' '}給我們 <button onClick={onContribute} className="hover:text-accent-500 underline">貢獻數據</button></p>
        </footer>
      </section>
    </main>
  )
}

function DistCard({ title, items }: { title: string; items: { label: string; count: number }[] }) {
  const max = items[0]?.count ?? 1
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-xl p-5">
      <h3 className="serif text-base mb-4">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.label} className="flex items-center gap-3 text-sm">
            <span className="w-20 text-fog-300 truncate shrink-0">{it.label}</span>
            <div className="flex-1 h-2 bg-ink-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-500"
                style={{ width: `${(it.count / max) * 100}%` }}
              />
            </div>
            <span className="mono text-xs text-fog-500 w-8 text-right">{it.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
