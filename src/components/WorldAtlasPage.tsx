import { useEffect, useMemo, useState } from 'react'
import type { AtlasInstitution, AtlasProgram, AtlasRegion, AtlasSubject, WorldAtlasPayload } from '../data/worldAtlasTypes'
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
import { loadOverseasIndex } from '../lib/overseasData'
import { getOriginOption, type OriginRegion } from '../data/origins'
import { useLocale, type Locale } from '../i18n/react'
import { Rich } from '../i18n/rich'
import { SiteHeader } from './SiteHeader'
import { TierBadge } from './TierBadge'
import { worldAtlasManifest } from '../data/worldAtlasManifest'

interface Props {
  origin: OriginRegion | null
  onBack: () => void
  onAbout: () => void
  onSchool: (id: string) => void
  onStartMainland: () => void
  onHkMoTw: () => void
  /** 海外可申請學校層：帶地區 slug 與機構 id 直接展開該機構的招生條件。 */
  onOverseas: (regionSlug: string | null, institutionId: string | null) => void
}

/** 學科名：payload 自帶三種字形（nameZh／nameZhHans／nameEn）。 */
function subjectName(subject: AtlasSubject, locale: Locale): string {
  if (locale === 'en') return subject.nameEn
  if (locale === 'zh-Hans') return subject.nameZhHans || subject.nameZh
  return subject.nameZh
}

/** 地區名：payload 的 nameZh 是 Wikidata 正體標籤（資料，不轉字形）；en 用地區代碼（英文名）。 */
function regionName(region: AtlasRegion | undefined, code: string, locale: Locale): string {
  if (!region) return code
  return locale === 'en' ? region.code : region.nameZh
}

function institutionExternalUrl(institution: AtlasInstitution): string | null {
  return institution.univUp ? `https://www.shanghairanking.com/institution/${institution.univUp}` : null
}

export function WorldAtlasPage({ origin, onBack, onAbout, onSchool, onStartMainland, onHkMoTw, onOverseas }: Props) {
  const { t, locale } = useLocale()
  const [payload, setPayload] = useState<WorldAtlasPayload | null>(null)
  // 港澳臺院校池裡有管道說明的機構（以 GRAS 機構 id 對照）；池載不到就只是少一個鏈接，不影響地圖。
  const [poolAtlasIds, setPoolAtlasIds] = useState<Set<string>>(() => new Set())
  // 海外可申請學校層（S3）：機構 id → 地區 slug；索引載不到就只是少一個入口。
  const [overseasRegionById, setOverseasRegionById] = useState<Map<string, string>>(() => new Map())
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
  useEffect(() => {
    let alive = true
    loadOverseasIndex()
      .then((index) => {
        if (!alive) return
        const slugByRegion = new Map(index.regions.map((r) => [r.code, r.slug]))
        setOverseasRegionById(new Map(index.institutions.map((i) => [i.id, slugByRegion.get(i.region) ?? ''] as const).filter(([, slug]) => slug)))
      })
      .catch(() => undefined)
    return () => { alive = false }
  }, [])
  const retryLoad = () => {
    setLoadError(null)
    setReloadToken((token) => token + 1)
  }

  const view = useMemo(() => (payload ? computeAtlasView(payload, selection) : null), [payload, selection])
  const regionByCode = useMemo(
    () => new Map((payload?.regions ?? []).map((region) => [region.code, region])),
    [payload],
  )
  const regionLabel = (code: string) => regionName(regionByCode.get(code), code, locale)
  const institutionLabel = (institution: AtlasInstitution): string =>
    institution.nameZh ? t('ui.world.institutionLabel', { nameZh: institution.nameZh, nameEn: institution.nameEn }) : institution.nameEn
  const primaryName = (institution: AtlasInstitution): string => (locale === 'en' ? institution.nameEn : institution.nameZh ?? institution.nameEn)
  const secondaryName = (institution: AtlasInstitution): string | null => (locale === 'en' ? (institution.nameZh ?? null) : institution.nameZh ? institution.nameEn : null)
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
          <p className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">{t('ui.world.kicker')}</p>
          <h1 className="serif text-2xl">{loadError ? t('ui.world.loadFailed') : t('ui.world.loading')}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">
            {loadError ?? t('ui.world.loadingNote')}
          </p>
          <div className="flex flex-wrap gap-3">
            {loadError && (
              <button onClick={retryLoad} className="px-5 py-3 rounded-full bg-accent-500 text-ink-950 text-sm font-semibold hover:bg-accent-400">
                {t('ui.common.retryLoad')}
              </button>
            )}
            <button onClick={onBack} className="px-5 py-3 rounded-full border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500">
              {t('ui.common.backHome')}
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
  const seatText = (seat: AtlasInstitutionView['seats'][number]) => t('ui.world.seatRank', { subject: subjectName(seat.subject, locale), rank: seat.rank })

  return (
    <main className="min-h-screen app-canvas text-fog-100 page-end-space">
      <SiteHeader sticky brand={t('ui.world.brand')} back={{ label: t('ui.common.back'), onClick: onBack }} actions={[{ label: t('ui.common.about'), onClick: onAbout }]} />

      <section className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-8">
        <div className="max-w-3xl flex flex-col gap-3">
          <h1 className="serif text-3xl sm:text-5xl leading-tight">{t('ui.world.title')}</h1>
          <p className="text-sm sm:text-base text-fog-300 leading-relaxed">
            {t('ui.world.lede', { ranking: locale === 'en' ? payload.ranking.name : payload.ranking.nameZh, year: payload.ranking.year, subjects: payload.subjects.length, topN: selection.topN })}
          </p>
          {originOption && !originOption.hasLocalPool && (
            <div className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 text-sm text-fog-300 leading-relaxed">
              <Rich
                k="ui.world.originNote"
                params={{
                  origin: t(`origin.${originOption.id}.label`),
                  pools: (origin === 'hk' || origin === 'mo' || origin === 'tw')
                    ? <Rich k="ui.world.originNote.poolHkmotw" slots={{ a2: (children) => <button onClick={onHkMoTw} className="underline hover:text-accent-500">{children}</button> }} />
                    : origin === 'overseas'
                      ? <Rich k="ui.world.originNote.poolOverseas" slots={{ a3: (children) => <button onClick={() => onOverseas(null, null)} className="underline hover:text-accent-500">{children}</button> }} />
                      : '',
                }}
                slots={{ a1: (children) => <button onClick={onStartMainland} className="underline hover:text-accent-500 ml-1">{children}</button> }}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs mono">
            <span className="uppercase tracking-[0.2em] text-fog-500">{t('ui.world.topN')}</span>
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
              {t('ui.world.programsToggle', { n: payload.programs.length })}
            </button>
            {struckCount > 0 && (
              <button onClick={resetSelection} className="px-4 min-h-[40px] rounded-full border border-ink-700 bg-ink-900 text-sm text-fog-300 hover:text-fog-100">
                {t('ui.world.reset', { n: struckCount })}
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
                  {struck ? t('ui.world.struckPrefix') : ''}{locale === 'en' ? family.nameEn : family.nameZh}
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
            aria-label={t('ui.world.mapAria', { institutions: view.totals.institutions, seats: view.totals.seats })}
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
                      aria-label={t('ui.world.dotAria', { institution: institutionLabel(institution), n: seats.length })}
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
                      aria-label={t('ui.world.programAria', { org: locale === 'en' ? program.orgEn : program.orgZh, program: locale === 'en' ? program.programEn : program.programZh })}
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
              <p className="mono text-fog-500">{t('ui.world.tooltipSeats', { region: regionLabel(tooltipEntry.institution.region), n: tooltipEntry.seats.length })}</p>
              <p className="text-fog-300">{tooltipEntry.seats.slice(0, 4).map(seatText).join(' · ')}{tooltipEntry.seats.length > 4 ? ' …' : ''}</p>
            </div>
          )}
          <div className="border-t border-ink-800 px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs mono text-fog-500">
            <span>
              <Rich k="ui.world.totals" params={{ subjects: <b className="text-sm">{view.totals.subjects}</b>, institutions: <b className="text-sm">{view.totals.institutions}</b>, regions: <b className="text-sm">{view.totals.regions}</b>, seats: <b className="text-sm">{view.totals.seats}</b> }} />
            </span>
            <span>{t('ui.world.legend')}</span>
          </div>
        </div>

        {(selected || selectedProgram) && (
          <div className="border border-accent-500/40 bg-ink-900 rounded-2xl px-4 sm:px-6 py-5 flex flex-col gap-3">
            {selected && <SelectedInstitution entry={selected} regionName={regionLabel(selected.institution.region)} primaryName={primaryName} secondaryName={secondaryName} seatText={seatText} onSchool={onSchool} onToggleRegion={toggleRegion} onClose={() => setSelectedId(null)} inHkMoTwPool={poolAtlasIds.has(selected.institution.id)} onHkMoTw={onHkMoTw} overseasRegion={overseasRegionById.get(selected.institution.id) ?? null} onOverseas={onOverseas} />}
            {selectedProgram && <ProgramCard program={selectedProgram} expanded onClose={() => setSelectedProgramId(null)} />}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="serif text-2xl">{t('ui.world.subjects.title')}</h2>
              <span className="text-xs mono text-fog-500">{t('ui.world.subjects.hint')}</span>
            </div>
            {subjectsByFamily.map(({ family, subjects }) => {
              const familyStruck = selection.struckFamilies.has(family.code)
              return (
                <div key={family.code} className="flex flex-col gap-2">
                  <p className={['mono text-xs uppercase tracking-[0.2em]', familyStruck ? 'text-fog-500 line-through' : 'text-fog-300'].join(' ')}>
                    {locale === 'en' ? family.nameEn : `${family.nameZh} · ${family.nameEn}`}
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
                          title={locale === 'en' ? subject.nameZh : subject.nameEn}
                          className={[
                            'px-3 py-2 rounded-lg border text-sm min-h-[40px]',
                            struck ? 'border-ink-800 bg-ink-950 text-fog-500 line-through' : 'border-ink-700 bg-ink-900 text-fog-100 hover:border-accent-500',
                            familyStruck ? 'cursor-not-allowed' : '',
                          ].join(' ')}
                        >
                          {subjectName(subject, locale)}
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
              <h2 className="serif text-2xl">{t('ui.world.regions.title')}</h2>
              <span className="text-xs mono text-fog-500">{t('ui.world.regions.seats')}</span>
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
                        {locale === 'en' ? region.code : <>{region.nameZh} <span className="mono text-xs text-fog-500">{region.code}</span></>}
                      </span>
                      <span className="mono text-xs text-fog-500">{struck ? t('ui.world.regions.struck') : t('ui.world.regions.count', { seats, institutions })}</span>
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
              <h2 className="serif text-2xl">{t('ui.world.programs.title')}</h2>
              <p className="text-sm text-fog-300 leading-relaxed">
                {t('ui.world.programs.note')}
              </p>
              {worldAtlasManifest.counts.programsUnverified > 0 && (
                <p className="text-xs text-fog-500 leading-relaxed" data-programs-unverified={worldAtlasManifest.counts.programsUnverified}>{t('ui.world.programs.unverifiedNote', { n: worldAtlasManifest.counts.programsUnverified })}</p>
              )}
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
            <h2 className="serif text-2xl">{t('ui.world.remaining.title')}</h2>
            <span className="text-xs mono text-fog-500">{t('ui.world.remaining.hint', { n: Math.min(60, keptList.length) })}</span>
          </div>
          {/* 手機（<640px）：堆疊卡片，避免表格在 390 寬撐到 474px 橫捲；≥640px 維持表格 */}
          <ul className="sm:hidden flex flex-col gap-2" data-world-remaining-cards>
            {keptList.slice(0, 60).map(({ institution, seats }) => (
              <li key={institution.id}>
                <button
                  type="button"
                  onClick={() => { setSelectedId(institution.id); setSelectedProgramId(null); window.scrollTo({ top: 0, behavior: 'instant' }) }}
                  className="w-full text-left border border-ink-800 rounded-xl bg-ink-900 px-4 py-3 flex flex-col gap-1 min-h-[44px] hover:border-accent-500"
                >
                  <span className="text-sm text-fog-100">{primaryName(institution)}</span>
                  {secondaryName(institution) && <span className="text-xs text-fog-500">{secondaryName(institution)}</span>}
                  <span className="text-xs text-fog-300">{regionLabel(institution.region)} · <span className="mono">{t('ui.world.table.seats')} {seats.length}</span></span>
                  <span className="text-xs text-fog-300 leading-relaxed">{seats.slice(0, 3).map(seatText).join(' · ')}</span>
                </button>
              </li>
            ))}
            {keptList.length === 0 && <li className="px-3 py-6 text-center text-sm text-fog-500">{t('ui.world.table.empty')}</li>}
          </ul>
          <div className="hidden sm:block overflow-x-auto border border-ink-800 rounded-xl bg-ink-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left mono text-xs uppercase tracking-[0.16em] text-fog-500 border-b border-ink-800">
                  <th className="px-3 py-2 font-medium">{t('ui.world.table.institution')}</th>
                  <th className="px-3 py-2 font-medium">{t('ui.world.table.region')}</th>
                  <th className="px-3 py-2 font-medium text-right">{t('ui.world.table.seats')}</th>
                  <th className="px-3 py-2 font-medium">{t('ui.world.table.topSubjects')}</th>
                </tr>
              </thead>
              <tbody>
                {keptList.slice(0, 60).map(({ institution, seats }) => (
                  <tr key={institution.id} className="border-b border-ink-800 last:border-b-0 align-top">
                    <td className="px-3 py-2">
                      <button onClick={() => { setSelectedId(institution.id); setSelectedProgramId(null); window.scrollTo({ top: 0, behavior: 'instant' }) }} className="block w-full min-h-[40px] text-left text-fog-100 hover:text-accent-500">
                        {primaryName(institution)}
                        {secondaryName(institution) && <span className="block text-xs text-fog-500">{secondaryName(institution)}</span>}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-fog-300 whitespace-nowrap">{regionLabel(institution.region)}</td>
                    <td className="px-3 py-2 text-right mono text-fog-100">{seats.length}</td>
                    <td className="px-3 py-2 text-fog-300">{seats.slice(0, 3).map(seatText).join(' · ')}</td>
                  </tr>
                ))}
                {keptList.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-fog-500">{t('ui.world.table.empty')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed flex flex-col gap-2">
          {/* 2026-11-08 批 G5：資料頁只留一行來源；座標、官網、陸地輪廓與排名限制見 About */}
          <p>
            <Rich
              k="ui.world.footer.sources"
              params={{ ranking: payload.ranking.name, year: payload.ranking.year, fetchedAt: payload.ranking.fetchedAt, topNMax: payload.ranking.topNMax }}
              slots={{
                a1: (children) => <a className="hover:text-accent-500 underline" href={payload.ranking.url} target="_blank" rel="noreferrer noopener">{children}</a>,
                a2: (children) => <button onClick={onAbout} className="underline hover:text-accent-500">{children}</button>,
              }}
            />
          </p>
        </footer>
      </section>
    </main>
  )
}

function SelectedInstitution({
  entry,
  regionName,
  primaryName,
  secondaryName,
  seatText,
  onSchool,
  onToggleRegion,
  onClose,
  inHkMoTwPool,
  onHkMoTw,
  overseasRegion,
  onOverseas,
}: {
  entry: AtlasInstitutionView
  regionName: string
  primaryName: (institution: AtlasInstitution) => string
  secondaryName: (institution: AtlasInstitution) => string | null
  seatText: (seat: AtlasInstitutionView['seats'][number]) => string
  onSchool: (id: string) => void
  onToggleRegion: (code: string) => void
  onClose: () => void
  inHkMoTwPool: boolean
  onHkMoTw: () => void
  overseasRegion: string | null
  onOverseas: (regionSlug: string | null, institutionId: string | null) => void
}) {
  const { t, locale } = useLocale()
  const { institution, seats, struckByRegion } = entry
  const external = institutionExternalUrl(institution)
  const secondary = secondaryName(institution)
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{regionName}{struckByRegion ? t('ui.world.selected.regionStruck') : ''}</p>
          <h3 className="serif text-2xl text-fog-100 mt-1">{primaryName(institution)}</h3>
          {secondary && <p className="text-sm text-fog-300">{secondary}</p>}
        </div>
        <button onClick={onClose} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] px-2">{t('ui.common.close')}</button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {seats.map((seat) => (
          <li key={seat.subject.code}>
            <a
              className="inline-block rounded-full border border-ink-700 bg-ink-950 px-3 py-1 text-sm text-fog-100 hover:border-accent-500"
              href={seat.subject.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              title={t('ui.world.selected.rankTitle', { subject: seat.subject.nameEn })}
            >
              {seatText(seat).replace(/ #\d+$/, '')} <span className="mono text-xs text-fog-500">#{seat.rank} ↗</span>
            </a>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {institution.schoolId && (
          <button onClick={() => onSchool(institution.schoolId!)} className="px-4 py-2 rounded-full bg-accent-500 text-ink-950 font-semibold hover:bg-accent-400 min-h-[40px]">
            {t('ui.world.selected.schoolDetail')}
          </button>
        )}
        {inHkMoTwPool && (
          <button onClick={onHkMoTw} className="px-4 py-2 rounded-full border border-accent-500/40 bg-accent-500/10 text-accent-600 hover:bg-accent-500/15 min-h-[40px]">
            {t('ui.world.selected.hkmotw')}
          </button>
        )}
        {overseasRegion && (
          <button onClick={() => onOverseas(overseasRegion, institution.id)} className="px-4 py-2 rounded-full border border-accent-500/40 bg-accent-500/10 text-accent-600 hover:bg-accent-500/15 min-h-[40px]" title={t('ui.world.selected.overseasTitle')}>
            {t('ui.world.selected.overseas')}
          </button>
        )}
        {institution.website && (
          <a
            className="px-4 py-2 rounded-full border border-ink-700 text-fog-100 hover:border-accent-500 min-h-[40px] inline-flex items-center"
            href={institution.website.url}
            target="_blank"
            rel="noreferrer noopener"
            title={`${institution.website.confidence === 'high' ? t('ui.world.selected.websiteTitle.high') : t('ui.world.selected.websiteTitle.medium')} · ${t('ui.world.selected.websiteVerified', { verifiedAt: institution.website.verifiedAt })}`}
          >
            {t('ui.common.officialSite')}
          </a>
        )}
        {external && (
          <a className="tap mono text-xs text-fog-500 hover:text-accent-500 underline" href={external} target="_blank" rel="noreferrer noopener">
            {t('ui.world.selected.srPage')}
          </a>
        )}
        <button onClick={() => onToggleRegion(institution.region)} className="mono text-xs text-fog-500 hover:text-accent-500 underline" lang={locale}>
          {struckByRegion ? t('ui.world.selected.restoreRegion', { region: regionName }) : t('ui.world.selected.strikeRegion', { region: regionName })}
        </button>
      </div>
    </>
  )
}

function ProgramCard({ program, expanded, onOpen, onClose }: { program: AtlasProgram; expanded: boolean; onOpen?: () => void; onClose: () => void }) {
  const { t, tOr, locale } = useLocale()
  const en = locale === 'en'
  const paid = program.paid === 'yes' ? t('ui.world.program.paid.yes') : program.paid === 'stipend' ? t('ui.world.program.paid.stipend') : program.paid === 'no' ? t('ui.world.program.paid.no') : t('ui.world.program.unverified')
  const degree = program.degree === 'yes' ? t('ui.world.program.degree.yes') : program.degree === 'partial' ? t('ui.world.program.degree.partial') : program.degree === 'no' ? t('ui.world.program.degree.no') : t('ui.world.program.unverified')
  // 含在職學位（degree=yes）與混合入口（degree=partial）沿用既有 Dyson／Goldman Sachs／Siemens／Shopify 口徑一併列入，並明示標籤。
  const degreeBadge = program.degree === 'yes' ? t('ui.world.program.degreeBadge') : program.degree === 'partial' ? t('ui.world.program.degreeBadge.partial') : null
  const country = tOr(`ui.world.program.country.${program.regionKey}`, en ? program.country : program.regionZh)
  const kind = tOr(`ui.world.program.kind.${program.kind}`, en ? program.kind : program.kindZh)
  return (
    <article className={['rounded-xl border px-4 py-3 flex flex-col gap-2 h-full', expanded ? 'border-accent-500/40 bg-ink-900' : 'border-ink-800 bg-ink-900'].join(' ')} data-program={program.id} data-degree={program.degree}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{`${country} · ${en ? program.city : program.cityZh} · ${kind}`}</p>
          <h3 className="serif text-lg text-fog-100 mt-1">{en ? `${program.orgEn}: ${program.programEn}` : `${program.orgZh}：${program.programZh}`}</h3>
          <p className="text-xs text-fog-500">{en ? `${program.orgZh} · ${program.programZh}` : `${program.orgEn} · ${program.programEn}`}</p>
          {degreeBadge && <p className="mt-1"><span className="inline-block rounded border border-accent-500/40 bg-accent-500/10 px-2 py-px text-xs mono text-accent-600" data-degree-badge={program.degree}>{degreeBadge}</span></p>}
        </div>
        {expanded
          ? <button onClick={onClose} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] px-2">{t('ui.common.close')}</button>
          : onOpen && <button onClick={onOpen} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] px-2">{t('ui.world.program.expand')}</button>}
      </div>
      <p className="text-sm text-fog-300 leading-relaxed"><b className="text-fog-100">{t('ui.world.program.eligibility')}</b>{program.eligibilityZh}</p>
      {expanded && (
        <>
          <p className="text-sm text-fog-300 leading-relaxed"><b className="text-fog-100">{t('ui.world.program.offers')}</b>{program.offersZh}</p>
          <p className="text-xs text-fog-500 leading-relaxed">
            {t('ui.world.program.paid')}{paid} ·{' '}
            {t('ui.world.program.degree')}{degree} ·
            {program.sinceYear ? t('ui.world.program.since', { year: program.sinceYear }) : ''} {t('ui.world.program.status', { status: program.status })}
          </p>
          {program.notesZh && <p className="text-xs text-fog-500 leading-relaxed">{program.notesZh}</p>}
        </>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs mono text-fog-500 mt-auto pt-1">
        {program.officialUrl && <span className="inline-flex items-center gap-1"><a className="underline hover:text-accent-500" href={program.officialUrl} target="_blank" rel="noreferrer noopener">{t('ui.world.program.officialPage')}</a><TierBadge url={program.officialUrl} /></span>}
        <span className="inline-flex items-center gap-1"><a className="underline hover:text-accent-500" href={program.sourceUrl} target="_blank" rel="noreferrer noopener">{t('ui.world.program.source')}</a><TierBadge url={program.sourceUrl} /></span>
        <span>{t('ui.world.program.verified', { verifiedAt: program.verifiedAt, confidence: t(`ui.world.confidence.${program.confidence}`) })}</span>
      </div>
    </article>
  )
}
