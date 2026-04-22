import { useMemo, useRef, useState } from 'react'
import type { FilterResult, AnswerMap, ExcludeReason } from '../engine/filter'
import { explainKept, suggestRelax, distribute } from '../engine/filter'
import {
  candidateProvinceOptions,
  defaultCandidateProvince,
  getAdmissionResourceLinks,
  type CandidateProvince,
} from '../data/admissionAuthorities'
import { buildSchoolTags } from '../lib/schoolProfile'
import { normalizeSchoolName } from '../lib/schoolName'
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

type LookupEntry =
  | { kind: 'kept'; school: FilterResult['kept'][number] }
  | { kind: 'excluded'; school: FilterResult['excluded'][number]['school']; reasons: ExcludeReason[] }

function cityTierBadge(tier: string | undefined): string {
  if (tier === 'tier1') return 'T1'
  if (tier === 'newtier1') return 'NT1'
  if (tier === 'tier2') return 'T2'
  if (tier === 'tier3_below') return 'T3-'
  return 'T?'
}

function formatReason(reason: ExcludeReason): string {
  return `${reason.questionTitle} · 你選了「${reason.userAnswerLabel}」 · 該校是「${reason.schoolValue}」`
}

export function ResultPage({ result, answers, onRestart, onRelax, onSchool, onAbout, onContribute }: Props) {
  const shareRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [candidateProvince, setCandidateProvince] = useState<CandidateProvince>(defaultCandidateProvince)
  const [schoolQuery, setSchoolQuery] = useState('')

  const dist = useMemo(() => distribute(result.kept), [result.kept])
  const relaxHints = useMemo(() => suggestRelax(result.stats, 3), [result.stats])
  const topKept = result.kept.slice(0, 24)

  const lookupResults = useMemo(() => {
    const query = schoolQuery.trim()
    if (!query) return [] as LookupEntry[]
    const normalizedQuery = normalizeSchoolName(query)
    const keptMatches: LookupEntry[] = result.kept.map((school) => ({ kind: 'kept', school }))
    const excludedMatches: LookupEntry[] = result.excluded.map(({ school, reasons }) => ({
      kind: 'excluded',
      school,
      reasons,
    }))

    return [...keptMatches, ...excludedMatches]
      .filter((entry) => {
        const haystacks = [
          entry.school.name,
          entry.school.nameSimplified ?? '',
          entry.school.province,
          entry.school.city,
        ].map((value) => normalizeSchoolName(value))
        return haystacks.some((value) => value.includes(normalizedQuery))
      })
      .sort((left, right) => {
        const leftExact = normalizeSchoolName(left.school.name) === normalizedQuery ? 1 : 0
        const rightExact = normalizeSchoolName(right.school.name) === normalizedQuery ? 1 : 0
        return rightExact - leftExact
      })
      .slice(0, 8)
  }, [result.excluded, result.kept, schoolQuery])

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
  const shortlistReached = result.stats.answeredCount > 0 && result.stats.keptCount <= 10
  const showRelaxAction = !zero && result.stats.answeredCount > 0

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between text-xs mono uppercase tracking-[0.2em] text-fog-500">
          <span>nope · result</span>
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={onAbout} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">about</button>
            <button onClick={onContribute} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">貢獻</button>
          </div>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24 sm:pt-12 flex flex-col gap-10 sm:gap-14">
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
          {shortlistReached && (
            <div className="max-w-2xl rounded-2xl border border-accent-500/30 bg-ink-900/80 px-4 py-4 text-sm text-fog-300 leading-relaxed">
              {zero
                ? '這一輪已經篩到 0 所，先停在報告頁。建議直接清空重來，換一組條件再做一輪。'
                : `這一輪已經縮到 ${result.stats.keptCount} 所，所以先收束到報告。你仍然可以回去改條件，或直接清空重來。`}
            </div>
          )}
        </div>

        {zero && (
          <div className="bg-ink-900 border border-accent-600/50 rounded-2xl p-6 flex flex-col gap-3">
            <p className="serif text-lg">這一輪沒有保留下來的學校。</p>
            <p className="text-sm text-fog-300">
              你的條件目前和整個官方目錄都對不上。排除最多的幾題是：
              {relaxHints.map((hint, index) => (
                <span key={index} className="block mt-1 text-fog-500">· {hint}</span>
              ))}
            </p>
            <button
              onClick={onRestart}
              className="self-start px-5 py-2 rounded-full bg-accent-500 text-ink-950 font-semibold text-sm hover:bg-accent-400"
            >
              清空重來
            </button>
          </div>
        )}

        {!zero && (
          <div className="grid sm:grid-cols-2 gap-6">
            <DistCard title="按省份" items={dist.byProvince.slice(0, 8)} />
            <DistCard title="按層次" items={dist.byLevel} />
          </div>
        )}

        {!zero && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 className="serif text-xl">還在場的學校</h2>
                <p className="mt-2 text-xs text-fog-500 leading-relaxed">
                  每張卡都附帶核心標籤、官網、陽光高考院校庫，以及你所選考生地區的權威錄取查詢入口。
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] text-fog-500 uppercase tracking-[0.2em] shrink-0">考生地區</span>
                <select
                  value={candidateProvince}
                  onChange={(e) => setCandidateProvince(e.target.value as CandidateProvince)}
                  className="bg-ink-900 border border-ink-700 rounded-full px-3 py-2 text-xs text-fog-200 min-h-[40px]"
                >
                  {candidateProvinceOptions.map((province) => (
                    <option key={province} value={province}>{province}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {topKept.map((school) => (
                <div
                  key={school.id}
                  className="bg-ink-900 border border-ink-700 rounded-xl p-4 flex flex-col gap-4 hover:border-accent-500 transition-colors"
                >
                  <button onClick={() => onSchool(school.id)} className="text-left">
                    <div className="flex items-start justify-between gap-3">
                      <span className="serif text-base">{school.name}</span>
                      <span className="mono text-[10px] text-fog-500 uppercase tracking-wider mt-1 shrink-0">
                        {cityTierBadge(school.cityTier)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-fog-500">{explainKept(school, answers)}</p>
                  </button>
                  <TagRail tags={buildSchoolTags(school)} />
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-ink-800">
                    {getAdmissionResourceLinks(school, candidateProvince).map((link) => (
                      <a
                        key={`${school.id}-${link.label}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={[
                          'px-3 py-2 rounded-full text-[11px] mono min-h-[40px] inline-flex items-center',
                          link.kind === 'official'
                            ? 'bg-accent-500/12 text-accent-400 border border-accent-500/30'
                            : 'bg-ink-950 text-fog-300 border border-ink-700 hover:border-fog-500',
                        ].join(' ')}
                        title={link.note}
                      >
                        {link.label} ↗
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-fog-500 leading-relaxed">
              已接入 31 個省級官方招考入口；北京同時提供近年錄取/分數線直鏈，其他省份會持續補齊直達查詢頁。
            </p>
          </div>
        )}

        <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <h2 className="serif text-xl">查一所學校</h2>
            <p className="mt-2 text-sm text-fog-500 leading-relaxed">
              結果裡沒看到你的學校，或者想知道某所學校為什麼留下來／被排掉，就在這裡查名字。
            </p>
          </div>
          <input
            value={schoolQuery}
            onChange={(e) => setSchoolQuery(e.target.value)}
            placeholder="輸入學校名，例如：西安交通大學 / 中央音樂學院"
            className="w-full bg-ink-950 border border-ink-700 rounded-xl px-4 py-3 text-sm text-fog-100 placeholder:text-fog-500"
          />
          {!schoolQuery.trim() && (
            <p className="text-xs text-fog-500 leading-relaxed">
              這裡會同時搜索保留名單和已排除學校，方便你核對「心儀的學校為什麼不在裡面」。
            </p>
          )}
          {schoolQuery.trim() && lookupResults.length === 0 && (
            <p className="text-sm text-fog-500 leading-relaxed">
              沒找到匹配的學校。可以試試更短的名字，或者去掉校區/括號。
            </p>
          )}
          {lookupResults.length > 0 && (
            <div className="grid gap-3">
              {lookupResults.map((entry) => (
                <div
                  key={`${entry.kind}-${entry.school.id}`}
                  className="rounded-xl border border-ink-700 bg-ink-950/70 p-4 flex flex-col gap-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <button onClick={() => onSchool(entry.school.id)} className="text-left">
                        <h3 className="serif text-lg break-words">{entry.school.name}</h3>
                      </button>
                      <p className="mt-1 text-xs text-fog-500">{entry.school.province} · {entry.school.city}</p>
                    </div>
                    <span
                      className={[
                        'shrink-0 rounded-full px-3 py-1 text-[11px] mono border',
                        entry.kind === 'kept'
                          ? 'border-accent-500/40 text-accent-400 bg-accent-500/10'
                          : 'border-ink-700 text-fog-300 bg-ink-900',
                      ].join(' ')}
                    >
                      {entry.kind === 'kept' ? '仍在場' : `已排除 · ${entry.reasons.length} 題`}
                    </span>
                  </div>
                  <TagRail tags={buildSchoolTags(entry.school)} />
                  {entry.kind === 'kept' ? (
                    <p className="text-sm text-fog-300 leading-relaxed">
                      還沒被你劃掉：{explainKept(entry.school, answers)}。
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-fog-300 leading-relaxed">它這一輪被排掉的原因：</p>
                      <ul className="flex flex-col gap-2">
                        {entry.reasons.slice(0, 4).map((reason) => (
                          <li key={`${entry.school.id}-${reason.questionId}-${reason.schoolValue}`} className="text-xs text-fog-500 leading-relaxed">
                            · {formatReason(reason)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <div ref={shareRef}>
            <ShareCard result={result} />
          </div>
          <p className="text-sm text-fog-400 leading-relaxed">
            如果這輪減法對你有幫助，歡迎把網站發給熟悉不同學校的學長學姐、在讀同學和校友。人越多，能補上的校區、生活和招生數據就越完整。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={share}
              disabled={downloading}
              className="px-6 py-3 bg-accent-500 text-ink-950 rounded-full font-semibold text-sm hover:bg-accent-400 disabled:opacity-50 min-h-[48px]"
            >
              {downloading ? '生成中…' : '下載分享圖'}
            </button>
            {showRelaxAction && (
              <button
                onClick={onRelax}
                className="px-6 py-3 border border-fog-500 text-fog-100 rounded-full text-sm hover:border-accent-500 hover:text-accent-500 min-h-[48px]"
              >
                回去改條件
              </button>
            )}
            <button
              onClick={onContribute}
              className="px-6 py-3 border border-ink-700 text-fog-300 rounded-full text-sm hover:text-fog-100 min-h-[48px]"
            >
              貢獻數據
            </button>
            <button
              onClick={onRestart}
              className="px-6 py-3 border border-ink-700 text-fog-500 rounded-full text-sm hover:text-fog-100 min-h-[48px]"
            >
              清空重來
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

function TagRail({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-2">
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-full border border-ink-700 bg-ink-950 px-3 py-1 text-[11px] text-fog-300"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
