import { useEffect, useMemo, useState } from 'react'
import type { AtlasInstitution, AtlasProgram, WorldAtlasPayload } from '../data/worldAtlasTypes'
import {
  atlasTopNOptions,
  computeAtlasView,
  emptyAtlasSelection,
  seatRadius,
  toggleInSet,
  type AtlasInstitutionView,
  type AtlasSelection,
  type AtlasTopN,
} from '../engine/atlas'
import { loadWorldAtlas } from '../lib/atlasData'
import { loadHkMoTwPool } from '../lib/hkmotwData'
import { getOriginOption, type OriginRegion } from '../data/origins'

interface Props {
  origin: OriginRegion | null
  onBack: () => void
  onAbout: () => void
  onSchool: (id: string) => void
  onStartMainland: () => void
  onHkMoTw: () => void
}

const confidenceLabel: Record<AtlasProgram['confidence'], string> = {
  high: '官方頁已核',
  medium: '媒體報導為主',
  low: '待進一步核對',
}

function institutionLabel(institution: AtlasInstitution): string {
  return institution.nameZh ? `${institution.nameZh} · ${institution.nameEn}` : institution.nameEn
}

function institutionExternalUrl(institution: AtlasInstitution): string | null {
  return institution.univUp ? `https://www.shanghairanking.com/institution/${institution.univUp}` : null
}

export function WorldAtlasPage({ origin, onBack, onAbout, onSchool, onStartMainland, onHkMoTw }: Props) {
  const [payload, setPayload] = useState<WorldAtlasPayload | null>(null)
  // 港澳臺院校池裡有管道說明的機構（以 GRAS 機構 id 對照）；池載不到就只是少一個鏈接，不影響地圖。
  const [poolAtlasIds, setPoolAtlasIds] = useState<Set<string>>(() => new Set())
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [selection, setSelection] = useState<AtlasSelection>(emptyAtlasSelection)
  const [showPrograms, setShowPrograms] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    loadWorldAtlas()
      .then((loaded) => { if (alive) setPayload(loaded) })
      .catch((error: unknown) => { if (alive) setLoadError(error instanceof Error ? error.message : String(error)) })
    return () => { alive = false }
  }, [reloadToken])
  useEffect(() => {
    let alive = true
    loadHkMoTwPool()
      .then((pool) => { if (alive) setPoolAtlasIds(new Set(pool.institutions.filter((i) => i.atlasId).map((i) => i.atlasId as string))) })
      .catch(() => undefined)
    return () => { alive = false }
  }, [])
  const retryLoad = () => {
    setLoadError(null)
    setReloadToken((token) => token + 1)
  }

  const view = useMemo(() => (payload ? computeAtlasView(payload, selection) : null), [payload, selection])
  const regionNameByCode = useMemo(
    () => new Map((payload?.regions ?? []).map((region) => [region.code, region.nameZh])),
    [payload],
  )
  const viewById = useMemo(
    () => new Map((view?.institutions ?? []).map((entry) => [entry.institution.id, entry])),
    [view],
  )
  const selected = selectedId ? viewById.get(selectedId) ?? null : null
  const hovered = hoveredId ? viewById.get(hoveredId) ?? null : null
  const selectedProgram = selectedProgramId ? payload?.programs.find((program) => program.id === selectedProgramId) ?? null : null
  const originOption = origin ? getOriginOption(origin) : null

  const setTopN = (topN: AtlasTopN) => setSelection((prev) => ({ ...prev, topN }))
  const toggleFamily = (code: string) => setSelection((prev) => ({ ...prev, struckFamilies: toggleInSet(prev.struckFamilies, code) }))
  const toggleSubject = (code: string) => setSelection((prev) => ({ ...prev, struckSubjects: toggleInSet(prev.struckSubjects, code) }))
  const toggleRegion = (code: string) => setSelection((prev) => ({ ...prev, struckRegions: toggleInSet(prev.struckRegions, code) }))
  const resetSelection = () => { setSelection(emptyAtlasSelection); setSelectedId(null); setSelectedProgramId(null) }
  const struckCount = selection.struckFamilies.size + selection.struckSubjects.size + selection.struckRegions.size

  if (loadError || !payload || !view) {
    return (
      <main className="min-h-screen app-canvas text-fog-100 flex items-center justify-center px-5">
        <section className="w-full max-w-md border border-ink-800 bg-ink-900 rounded-xl p-6 flex flex-col gap-4">
          <p className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">world atlas</p>
          <h1 className="serif text-2xl">{loadError ? '地圖資料載入失敗' : '正在載入世界學科地圖'}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">
            {loadError ?? '57 個學科、每科前 50 名機構的座標與陸地輪廓只在進入本頁時載入。'}
          </p>
          <div className="flex flex-wrap gap-3">
            {loadError && (
              <button onClick={retryLoad} className="px-5 py-3 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">
                重試載入
              </button>
            )}
            <button onClick={onBack} className="px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">
              返回首頁
            </button>
          </div>
        </section>
      </main>
    )
  }

  const { width, height } = payload.projection
  const maxRegionSeats = Math.max(1, ...view.regionCounts.map((entry) => entry.seats))
  const subjectsByFamily = payload.families.map((family) => ({
    family,
    subjects: payload.subjects.filter((subject) => subject.family === family.code),
  }))
  const keptList = view.institutions.filter((entry) => !entry.struckByRegion)
  const tooltipEntry = hovered ?? null

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between text-xs mono uppercase tracking-[0.2em] text-fog-500">
          <button onClick={onBack} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">← 返回</button>
          <span>nope · world</span>
          <button onClick={onAbout} className="hover:text-accent-500 min-h-[44px] -my-3 py-3">about</button>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-8">
        <div className="max-w-3xl flex flex-col gap-3">
          <p className="mono text-xs uppercase tracking-[0.28em] text-accent-500">全球學科地圖 · 第一步</p>
          <h1 className="serif text-3xl sm:text-5xl leading-tight">人類此刻最強的學科，都在哪裡？</h1>
          <p className="text-sm sm:text-base text-fog-300 leading-relaxed">
            以{payload.ranking.nameZh} {payload.ranking.year}（{payload.subjects.length} 個學科，每科取前 {selection.topN} 名）為骨架，
            把各學科最前列的機構標在地圖上。它只描述研究產出的分佈，不是錄取難度、學費或教學品質，更不是推薦。
            你可以先劃掉一定不讀的學科、一定不去的地方，剩下的那些點，就是值得你接著查的地方。
          </p>
          {originOption && !originOption.hasLocalPool && (
            <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed">
              你選的起點是 <b className="text-fog-100">{originOption.label}</b>：{originOption.hint}。目前能用的是這張全球學科地圖
              {(origin === 'hk' || origin === 'mo' || origin === 'tw') && <>與 <button onClick={onHkMoTw} className="underline hover:text-accent-500">港澳臺院校池</button></>}；
              <button onClick={onStartMainland} className="underline hover:text-accent-500 ml-1">仍要看中國大陸題庫</button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs mono">
            <span className="uppercase tracking-[0.2em] text-fog-500">每科取前</span>
            <div className="inline-flex rounded-full border border-ink-700 bg-ink-900 overflow-hidden">
              {atlasTopNOptions.map((option) => (
                <button
                  key={option}
                  onClick={() => setTopN(option)}
                  aria-pressed={selection.topN === option}
                  className={[
                    'px-4 min-h-[40px] text-sm font-semibold',
                    selection.topN === option ? 'bg-accent-500 text-ink-950' : 'text-fog-300 hover:text-fog-100',
                  ].join(' ')}
                >
                  {option}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPrograms((value) => !value)}
              aria-pressed={showPrograms}
              className={[
                'px-4 min-h-[40px] rounded-full border text-sm',
                showPrograms ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-900 text-fog-300 hover:text-fog-100',
              ].join(' ')}
            >
              非大學路徑 · 企業直招高中生 {payload.programs.length}
            </button>
            {struckCount > 0 && (
              <button onClick={resetSelection} className="px-4 min-h-[40px] rounded-full border border-ink-700 bg-ink-900 text-sm text-fog-300 hover:text-fog-100">
                清空重來（已劃 {struckCount} 項）
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {payload.families.map((family) => {
              const struck = selection.struckFamilies.has(family.code)
              return (
                <button
                  key={family.code}
                  onClick={() => toggleFamily(family.code)}
                  aria-pressed={struck}
                  className={[
                    'px-4 py-2 rounded-full border text-sm min-h-[40px]',
                    struck ? 'border-ink-800 bg-ink-950 text-fog-500 line-through' : 'border-ink-700 bg-ink-900 text-fog-100 hover:border-accent-500',
                  ].join(' ')}
                >
                  {struck ? '已劃掉 ' : ''}{family.nameZh}
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative border border-ink-800 bg-ink-900 rounded-2xl overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="block w-full h-auto"
            role="img"
            aria-label={`世界學科地圖：剩 ${view.totals.institutions} 所機構、${view.totals.seats} 個學科席位`}
            onMouseLeave={() => setHoveredId(null)}
          >
            <g fillRule="evenodd">
              {payload.land.map((d, index) => <path key={index} d={d} className="atlas-land" />)}
            </g>
            <g>
              {[...view.institutions].reverse().map(({ institution, seats, struckByRegion }) => {
                const r = seatRadius(seats.length, selection.topN)
                const isSelected = institution.id === selectedId
                return (
                  <g key={institution.id}>
                    <circle
                      cx={institution.x}
                      cy={institution.y}
                      r={r}
                      className={[
                        struckByRegion ? 'atlas-dot-struck' : 'atlas-dot',
                        isSelected ? 'atlas-dot-selected' : '',
                      ].join(' ')}
                    />
                    <circle
                      cx={institution.x}
                      cy={institution.y}
                      r={Math.max(r + 5, 9)}
                      className="atlas-hit"
                      onMouseEnter={() => setHoveredId(institution.id)}
                      onFocus={() => setHoveredId(institution.id)}
                      onClick={() => { setSelectedId(institution.id); setSelectedProgramId(null) }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${institutionLabel(institution)}，${seats.length} 個學科席位`}
                    />
                  </g>
                )
              })}
            </g>
            {showPrograms && (
              <g>
                {payload.programs.map((program) => (
                  <g key={program.id} transform={`translate(${program.x} ${program.y})`}>
                    <rect x={-5} y={-5} width={10} height={10} transform="rotate(45)" className={program.id === selectedProgramId ? 'atlas-program atlas-dot-selected' : 'atlas-program'} />
                    <circle
                      r={10}
                      className="atlas-hit"
                      onClick={() => { setSelectedProgramId(program.id); setSelectedId(null) }}
                      tabIndex={0}
                      role="button"
                      aria-label={`${program.orgZh}：${program.programZh}`}
                    />
                  </g>
                ))}
              </g>
            )}
          </svg>
          {tooltipEntry && (
            <div
              className="hidden sm:block absolute pointer-events-none border border-ink-700 bg-ink-950 rounded-lg px-3 py-2 text-xs leading-relaxed max-w-xs"
              style={{
                left: `${(tooltipEntry.institution.x / width) * 100}%`,
                top: `${(tooltipEntry.institution.y / height) * 100}%`,
                transform: `translate(${tooltipEntry.institution.x > width * 0.6 ? '-105%' : '12px'}, -50%)`,
              }}
            >
              <p className="serif text-sm text-fog-100">{institutionLabel(tooltipEntry.institution)}</p>
              <p className="mono text-fog-500">{regionNameByCode.get(tooltipEntry.institution.region) ?? tooltipEntry.institution.region} · {tooltipEntry.seats.length} 個學科席位</p>
              <p className="text-fog-300">{tooltipEntry.seats.slice(0, 4).map((seat) => `${seat.subject.nameZh} #${seat.rank}`).join(' · ')}{tooltipEntry.seats.length > 4 ? ' …' : ''}</p>
            </div>
          )}
          <div className="border-t border-ink-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs mono text-fog-500">
            <span>
              剩 <b className="text-fog-100 text-sm">{view.totals.subjects}</b> 個學科 · <b className="text-fog-100 text-sm">{view.totals.institutions}</b> 所機構 ·
              {' '}<b className="text-fog-100 text-sm">{view.totals.regions}</b> 個國家地區 · <b className="text-fog-100 text-sm">{view.totals.seats}</b> 個學科席位
            </span>
            <span>點大小＝席位數 · 虛線＝所在地已劃掉 · 菱形＝企業直招</span>
          </div>
        </div>

        {(selected || selectedProgram) && (
          <div className="border border-accent-500/40 bg-ink-900 rounded-2xl px-4 sm:px-6 py-5 flex flex-col gap-3">
            {selected && <SelectedInstitution entry={selected} regionName={regionNameByCode.get(selected.institution.region) ?? selected.institution.region} onSchool={onSchool} onToggleRegion={toggleRegion} onClose={() => setSelectedId(null)} inHkMoTwPool={poolAtlasIds.has(selected.institution.id)} onHkMoTw={onHkMoTw} />}
            {selectedProgram && <ProgramCard program={selectedProgram} expanded onClose={() => setSelectedProgramId(null)} />}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="serif text-2xl">劃掉一定不讀的學科</h2>
              <span className="text-xs mono text-fog-500">點一下劃掉，再點一下放回</span>
            </div>
            {subjectsByFamily.map(({ family, subjects }) => {
              const familyStruck = selection.struckFamilies.has(family.code)
              return (
                <div key={family.code} className="flex flex-col gap-2">
                  <p className={['mono text-xs uppercase tracking-[0.2em]', familyStruck ? 'text-fog-500 line-through' : 'text-fog-300'].join(' ')}>
                    {family.nameZh} · {family.nameEn}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((subject) => {
                      const struck = familyStruck || selection.struckSubjects.has(subject.code)
                      return (
                        <button
                          key={subject.code}
                          onClick={() => toggleSubject(subject.code)}
                          disabled={familyStruck}
                          aria-pressed={struck}
                          title={subject.nameEn}
                          className={[
                            'px-3 py-2 rounded-lg border text-sm min-h-[40px]',
                            struck ? 'border-ink-800 bg-ink-950 text-fog-500 line-through' : 'border-ink-700 bg-ink-900 text-fog-100 hover:border-accent-500',
                            familyStruck ? 'cursor-not-allowed' : '',
                          ].join(' ')}
                        >
                          {subject.nameZh}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="serif text-2xl">劃掉一定不去的地方</h2>
              <span className="text-xs mono text-fog-500">席位數</span>
            </div>
            <ul className="flex flex-col gap-2">
              {view.regionCounts.map(({ region, seats, institutions, struck }) => (
                <li key={region.code}>
                  <button
                    onClick={() => toggleRegion(region.code)}
                    aria-pressed={struck}
                    className={[
                      'w-full text-left rounded-lg border px-3 py-2 flex flex-col gap-1 min-h-[44px]',
                      struck ? 'border-ink-800 bg-ink-950' : 'border-ink-700 bg-ink-900 hover:border-accent-500',
                    ].join(' ')}
                  >
                    <span className="flex items-center justify-between gap-3 text-sm">
                      <span className={struck ? 'text-fog-500 line-through' : 'text-fog-100'}>
                        {region.nameZh} <span className="mono text-xs text-fog-500">{region.code}</span>
                      </span>
                      <span className="mono text-xs text-fog-500">{struck ? '已劃掉' : `${seats} · ${institutions} 所`}</span>
                    </span>
                    {!struck && (
                      <span className="block h-1.5 w-full bg-ink-800 rounded-full">
                        <span className="block h-full bg-accent-500 rounded-full" style={{ width: `${Math.max(2, (seats / maxRegionSeats) * 100)}%` }} />
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {showPrograms && (
          <section className="flex flex-col gap-4">
            <div className="max-w-3xl flex flex-col gap-2">
              <h2 className="serif text-2xl">非大學路徑：繞過高校直接招高中生的計劃</h2>
              <p className="text-sm text-fog-300 leading-relaxed">
                近幾年一些公司與基金會開始在高中畢業時就直接選人：支薪 fellowship、雇主出錢的學位、全職預備研究員。
                這裡只列有官方頁或主流媒體報導、且能查到年齡／學歷條件的計劃，條目隨招募年度變動，站內只保證核對日當天為真。
              </p>
            </div>
            <ul className="grid gap-3 md:grid-cols-2">
              {payload.programs.map((program) => (
                <li key={program.id}>
                  <ProgramCard program={program} expanded={program.id === selectedProgramId} onClose={() => setSelectedProgramId(null)} onOpen={() => { setSelectedProgramId(program.id); setSelectedId(null) }} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="serif text-2xl">剩下的機構</h2>
            <span className="text-xs mono text-fog-500">按席位數排序 · 顯示前 {Math.min(60, keptList.length)} 所</span>
          </div>
          <div className="overflow-x-auto border border-ink-800 rounded-xl bg-ink-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left mono text-xs uppercase tracking-[0.16em] text-fog-500 border-b border-ink-800">
                  <th className="px-3 py-2 font-medium">機構</th>
                  <th className="px-3 py-2 font-medium">地區</th>
                  <th className="px-3 py-2 font-medium text-right">席位</th>
                  <th className="px-3 py-2 font-medium">最靠前的學科</th>
                </tr>
              </thead>
              <tbody>
                {keptList.slice(0, 60).map(({ institution, seats }) => (
                  <tr key={institution.id} className="border-b border-ink-800 last:border-b-0 align-top">
                    <td className="px-3 py-2">
                      <button onClick={() => { setSelectedId(institution.id); setSelectedProgramId(null); window.scrollTo({ top: 0, behavior: 'instant' }) }} className="text-left text-fog-100 hover:text-accent-500">
                        {institution.nameZh ?? institution.nameEn}
                        {institution.nameZh && <span className="block text-xs text-fog-500">{institution.nameEn}</span>}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-fog-300 whitespace-nowrap">{regionNameByCode.get(institution.region) ?? institution.region}</td>
                    <td className="px-3 py-2 text-right mono text-fog-100">{seats.length}</td>
                    <td className="px-3 py-2 text-fog-300">{seats.slice(0, 3).map((seat) => `${seat.subject.nameZh} #${seat.rank}`).join(' · ')}</td>
                  </tr>
                ))}
                {keptList.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-fog-500">全部劃完了。放回幾個學科或地區再看。</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed flex flex-col gap-2">
          <p>
            學科與名次：<a className="hover:text-accent-500 underline" href={payload.ranking.url} target="_blank" rel="noreferrer noopener">{payload.ranking.name} {payload.ranking.year}</a>（{payload.ranking.fetchedAt} 讀取，每科前 {payload.ranking.topNMax} 名）。
            機構座標與中文名：{payload.sources.geo.name}；學校官網：{payload.sources.websites.name}，只收核查通過的；陸地輪廓：{payload.sources.land.name}，只畫陸地、不畫國界。
          </p>
          <p>
            排名反映研究產出，不反映本科教學、錄取難度或學費。大陸機構可直接打開本站詳情頁；海外機構的專業、錄取條件與學費是下一階段的事，見 <button onClick={onAbout} className="underline hover:text-accent-500">about</button> 的路線圖說明。
          </p>
        </footer>
      </section>
    </main>
  )
}

function SelectedInstitution({
  entry,
  regionName,
  onSchool,
  onToggleRegion,
  onClose,
  inHkMoTwPool,
  onHkMoTw,
}: {
  entry: AtlasInstitutionView
  regionName: string
  onSchool: (id: string) => void
  onToggleRegion: (code: string) => void
  onClose: () => void
  inHkMoTwPool: boolean
  onHkMoTw: () => void
}) {
  const { institution, seats, struckByRegion } = entry
  const external = institutionExternalUrl(institution)
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{regionName}{struckByRegion ? ' · 所在地已劃掉' : ''}</p>
          <h3 className="serif text-2xl text-fog-100 mt-1">{institution.nameZh ?? institution.nameEn}</h3>
          {institution.nameZh && <p className="text-sm text-fog-300">{institution.nameEn}</p>}
        </div>
        <button onClick={onClose} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] px-2">關閉</button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {seats.map((seat) => (
          <li key={seat.subject.code}>
            <a
              className="inline-block rounded-full border border-ink-700 bg-ink-950 px-3 py-1 text-sm text-fog-100 hover:border-accent-500"
              href={seat.subject.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              title={`軟科 ${seat.subject.nameEn} 排名頁`}
            >
              {seat.subject.nameZh} <span className="mono text-xs text-fog-500">#{seat.rank} ↗</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {institution.schoolId && (
          <button onClick={() => onSchool(institution.schoolId!)} className="px-4 py-2 rounded-full bg-accent-500 text-ink-950 font-semibold hover:bg-accent-400 min-h-[40px]">
            看本站學校詳情 →
          </button>
        )}
        {inHkMoTwPool && (
          <button onClick={onHkMoTw} className="px-4 py-2 rounded-full border border-accent-500/40 bg-accent-500/10 text-accent-600 hover:bg-accent-500/15 min-h-[40px]">
            港澳臺院校池：招生管道 →
          </button>
        )}
        {institution.website && (
          <a
            className="px-4 py-2 rounded-full border border-ink-700 text-fog-100 hover:border-accent-500 min-h-[40px] inline-flex items-center"
            href={institution.website.url}
            target="_blank"
            rel="noreferrer noopener"
            title={`${institution.website.confidence === 'high' ? '兩個權威來源一致' : '單一權威來源'} · ${institution.website.verifiedAt} 連通核查`}
          >
            學校官網 ↗
          </a>
        )}
        {external && (
          <a className="mono text-xs text-fog-500 hover:text-accent-500 underline" href={external} target="_blank" rel="noreferrer noopener">
            軟科機構頁 ↗
          </a>
        )}
        <button onClick={() => onToggleRegion(institution.region)} className="mono text-xs text-fog-500 hover:text-accent-500 underline">
          {struckByRegion ? `放回 ${regionName}` : `劃掉 ${regionName}`}
        </button>
      </div>
    </>
  )
}

function ProgramCard({ program, expanded, onOpen, onClose }: { program: AtlasProgram; expanded: boolean; onOpen?: () => void; onClose: () => void }) {
  return (
    <article className={['rounded-xl border px-4 py-3 flex flex-col gap-2 h-full', expanded ? 'border-accent-500/40 bg-ink-900' : 'border-ink-800 bg-ink-900'].join(' ')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{program.regionZh} · {program.cityZh} · {program.kindZh}</p>
          <h3 className="serif text-lg text-fog-100 mt-1">{program.orgZh}：{program.programZh}</h3>
          <p className="text-xs text-fog-500">{program.orgEn} · {program.programEn}</p>
        </div>
        {expanded
          ? <button onClick={onClose} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] px-2">關閉</button>
          : onOpen && <button onClick={onOpen} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] px-2">展開</button>}
      </div>
      <p className="text-sm text-fog-300 leading-relaxed"><b className="text-fog-100">條件：</b>{program.eligibilityZh}</p>
      {expanded && (
        <>
          <p className="text-sm text-fog-300 leading-relaxed"><b className="text-fog-100">給什麼：</b>{program.offersZh}</p>
          <p className="text-xs text-fog-500 leading-relaxed">
            支薪：{program.paid === 'yes' ? '是' : program.paid === 'stipend' ? '津貼／資助' : program.paid === 'no' ? '否' : '未核'} ·
            學位：{program.degree === 'yes' ? '有' : program.degree === 'no' ? '無' : '未核'} ·
            {program.sinceYear ? ` ${program.sinceYear} 年起 ·` : ''} 狀態：{program.status}
          </p>
          {program.notesZh && <p className="text-xs text-fog-500 leading-relaxed">{program.notesZh}</p>}
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mono text-fog-500 mt-auto pt-1">
        {program.officialUrl && <a className="underline hover:text-accent-500" href={program.officialUrl} target="_blank" rel="noreferrer noopener">官方頁 ↗</a>}
        <a className="underline hover:text-accent-500" href={program.sourceUrl} target="_blank" rel="noreferrer noopener">來源 ↗</a>
        <span>{program.verifiedAt} 核對 · {confidenceLabel[program.confidence]}</span>
      </div>
    </article>
  )
}
