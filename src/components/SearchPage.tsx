import { useEffect, useMemo, useState } from 'react'
import { dbManifest } from '../data/dbManifest'
import type { ProgramCatalogPayload, ProgramIndexPayload, SubjectCode } from '../data/programsTypes'
import type { OverseasIndexPayload } from '../data/overseasTypes'
import type { WorldAtlasPayload } from '../data/worldAtlasTypes'
import { SUBJECT_OPTIONS, isSubjectCode } from '../data/programPrefs'
import { searchLayer } from '../data/searchLayer'
import { compareProvinces, sortProvinces } from '../data/provinceOrder'
import {
  buildSchoolIndex, grasTop50ForClass, makeFold, schoolsForMajor, searchMajors, searchSchools,
  type CrosswalkPair, type MajorHit, type MajorTarget, type SchoolGroup, type SearchRecord,
} from '../engine/search'
import { loadProgramCatalog, loadProgramIndex } from '../lib/programsData'
import { loadOverseasIndex } from '../lib/overseasData'
import { loadWorldAtlas } from '../lib/atlasData'
import { navigateHash } from '../lib/router'
import { provinceLabel, requirementLabel, subjectLabel } from '../lib/i18nLabels'
import { useLocale } from '../i18n/react'
import type { Locale } from '../i18n/core'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { OverseasRequirements } from './OverseasRequirements'
import { CycleButton } from './CycleButton'

/**
 * 查詢（2026-11-08 批 G7，路線圖目標第 4 條「可檢索招生等情況，尤其是專業」）：只讀、即時、三語。
 * 查學校：/db/v1 institutions＋crosswalk（不另存一份），簡繁互查、英文、別名、舊名；點進既有詳情頁。
 * 查專業：國標專業類／專業（英文走 GRAS 學科名），列開設的大陸學校與選考要求、來源省表；海外列對應 GRAS 學科前 50。
 * 結果按比對程度與代碼排列，不是推薦、不暗示錄取可能；不進 AnswerMap、不進 A+ 學習證據。
 */
const STORAGE_KEY = 'unapply.search.v1'
const fold = makeFold(searchLayer.foldPairs)
type Mode = 'school' | 'major'

interface SchoolData { groups: SchoolGroup[]; byId: Map<string, SearchRecord>; overseasSlug: Map<string, string>; regionName: Map<string, string> }
interface MajorData { catalog: ProgramCatalogPayload; index: ProgramIndexPayload; atlas: WorldAtlasPayload }

async function fetchDb<T>(file: string, schema: string): Promise<T> {
  const response = await fetch(`${dbManifest.base}${file}`)
  if (!response.ok) throw new Error(`${file} ${response.status}`)
  const body = await response.json() as T & { schema?: string }
  if (body.schema !== schema) throw new Error(`${file}: schema`)
  return body
}

function readStored(): { mode: Mode; q: string; combo: SubjectCode[]; province: string } {
  const fallback = { mode: 'school' as Mode, q: '', combo: [] as SubjectCode[], province: '' }
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<typeof fallback> | null
    let combo = Array.isArray(raw?.combo) ? raw!.combo.filter(isSubjectCode).slice(0, 3) : []
    if (!raw) {
      // 預設帶入大陸題 S1 的選科（本分頁作答，不另存）
      const s1 = (JSON.parse(window.sessionStorage.getItem('unapply.answers.v1') ?? '{}') as Record<string, unknown>).S1
      if (typeof s1 === 'string' && s1.length === 3) combo = [...s1].filter(isSubjectCode)
    }
    return { mode: raw?.mode === 'major' ? 'major' : 'school', q: typeof raw?.q === 'string' ? raw.q.slice(0, 80) : '', combo, province: typeof raw?.province === 'string' ? raw.province : '' }
  } catch { return fallback }
}

function displayName(record: SearchRecord, locale: Locale): string {
  const n = record.name
  if (locale === 'en') return n.en ?? n.zhHant ?? n.zhHans ?? n.original ?? record.id
  if (locale === 'zh-Hans') return n.zhHans ?? n.zhHant ?? n.original ?? n.en ?? record.id
  return n.zhHant ?? n.zhHans ?? n.original ?? n.en ?? record.id
}

export function SearchPage({ onBack }: { onBack: () => void }) {
  const { t, locale, n: fmt } = useLocale()
  const [stored] = useState(readStored)
  const [mode, setMode] = useState<Mode>(stored.mode)
  const [query, setQuery] = useState(stored.q)
  const [combo, setCombo] = useState<SubjectCode[]>(stored.combo)
  const [province, setProvince] = useState(stored.province)
  const [schoolData, setSchoolData] = useState<SchoolData | null>(null)
  const [majorData, setMajorData] = useState<MajorData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string | null>(null)
  const [mainlandLimit, setMainlandLimit] = useState(30)

  useEffect(() => { try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ mode, q: query, combo, province })) } catch { /* 存不下就算了 */ } }, [mode, query, combo, province])

  useEffect(() => {
    let alive = true
    Promise.all([
      fetchDb<{ records: SearchRecord[] }>('institutions.json', 'nope.db.v1.institutions'),
      fetchDb<{ pairs: CrosswalkPair[] }>('crosswalk.json', 'nope.db.v1.crosswalk'),
      loadOverseasIndex(),
    ]).then(([inst, cw, overseas]: [{ records: SearchRecord[] }, { pairs: CrosswalkPair[] }, OverseasIndexPayload]) => {
      if (!alive) return
      const regionSlug = new Map(overseas.regions.map((r) => [r.code, r.slug]))
      const overseasSlug = new Map(overseas.institutions.map((i) => [i.id, regionSlug.get(i.region) ?? '']).filter(([, s]) => s) as [string, string][])
      setSchoolData({ groups: buildSchoolIndex(inst.records, cw.pairs, searchLayer, fold), byId: new Map(inst.records.map((r) => [r.id, r])), overseasSlug, regionName: new Map(overseas.regions.map((r) => [r.code, r.nameZh])) })
    }).catch((e: unknown) => { if (alive) setError(String(e instanceof Error ? e.message : e)) })
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (mode !== 'major' || majorData) return
    let alive = true
    Promise.all([loadProgramCatalog(), loadProgramIndex(), loadWorldAtlas()])
      .then(([catalog, index, atlas]) => { if (alive) setMajorData({ catalog, index, atlas }) })
      .catch((e: unknown) => { if (alive) setError(String(e instanceof Error ? e.message : e)) })
    return () => { alive = false }
  }, [mode, majorData])

  const regionLabel = (code: string) => (locale === 'en' ? code : schoolData?.regionName.get(code) ?? majorData?.atlas.regions.find((r) => r.code === code)?.nameZh ?? code)
  const schoolResult = useMemo(() => (schoolData && mode === 'school' ? searchSchools(schoolData.groups, query, fold) : null), [schoolData, mode, query])
  const majorHits = useMemo<MajorHit[]>(() => (majorData && mode === 'major'
    ? searchMajors({ classes: majorData.catalog.classes, programs: majorData.catalog.programs.map((p) => ({ code: p.code, name: p.name, class: p.class })) }, majorData.atlas.subjects, searchLayer.classGras, query, fold)
    : []), [majorData, mode, query])
  const hitKey = (h: MajorHit) => (h.target.kind === 'program' ? `p:${h.target.programCode}` : `c:${h.target.classCode}`)
  const target: MajorTarget | null = (majorHits.find((h) => hitKey(h) === picked) ?? majorHits[0])?.target ?? null
  const comboSet = useMemo(() => (combo.length === 3 ? new Set(combo) : null), [combo])
  const mainland = useMemo(() => {
    if (!majorData || !target) return null
    const provinceOf = (code: string) => schoolData?.byId.get(`moe:${code}`)?.province ?? null
    const all = schoolsForMajor(majorData.index.schools, majorData.index, target, { provinceOf, province: province || null })
    const filtered = comboSet ? schoolsForMajor(majorData.index.schools, majorData.index, target, { provinceOf, province: province || null, combo: comboSet }) : all
    return { offering: all.offering, rows: filtered.rows }
  }, [majorData, target, province, comboSet, schoolData])
  const overseas = useMemo(() => (majorData && target ? grasTop50ForClass(target.classCode, searchLayer.classGras, majorData.atlas.institutions) : null), [majorData, target])
  const provinces = useMemo(() => (schoolData ? sortProvinces(new Set([...schoolData.byId.values()].filter((r) => r.scheme === 'moe' && r.province).map((r) => r.province!))) : []), [schoolData])

  const toggleSubject = (code: SubjectCode) => setCombo((c) => (c.includes(code) ? c.filter((x) => x !== code) : c.length >= 3 ? c : [...c, code]))
  const go = (hash: string) => navigateHash(hash)

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <SiteHeader brand={t('ui.search.brand')} back={{ label: t('ui.common.backHome'), onClick: onBack }} search={false} />
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-5 sm:pt-8 pb-16 flex flex-col gap-6" data-search-page>
        <div className="flex flex-col gap-2">
          <h1 className="serif text-3xl sm:text-4xl leading-tight">{t('ui.search.title')}</h1>
          <p className="text-sm text-fog-500 leading-relaxed">{t('ui.search.lede')}</p>
        </div>
        {/* 批 G9：「查學校／查專業」改為單鍵循環 */}
        <div className="flex flex-wrap items-center gap-2">
          <CycleButton name={t('ui.search.modeName')} data="search-mode" value={mode} onChange={(next) => { setMode(next); setPicked(null) }}
            options={[{ value: 'school' as Mode, label: t('ui.search.mode.school') }, { value: 'major' as Mode, label: t('ui.search.mode.major') }]} />
        </div>
        <label className="flex flex-col gap-2">
          <span className="text-sm text-fog-300">{mode === 'school' ? t('ui.search.school.label') : t('ui.search.major.label')}</span>
          <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPicked(null); setMainlandLimit(30) }} autoComplete="off" spellCheck={false}
            placeholder={mode === 'school' ? t('ui.search.school.placeholder') : t('ui.search.major.placeholder')}
            className="w-full rounded-ctl border border-ink-700 bg-ink-950 px-4 min-h-[48px] text-base text-fog-100 placeholder:text-fog-500 focus:border-accent-500 focus:outline-none" data-search-input />
        </label>
        {error && <p className="text-sm text-fog-300 border border-ink-800 bg-ink-900 rounded-panel px-4 py-3" role="alert">{t('ui.search.loadFailed')}</p>}
        {!error && ((mode === 'school' && !schoolData) || (mode === 'major' && !majorData)) && <p className="mono text-xs text-fog-500" data-search-loading>{t('ui.search.loading')}</p>}

        {mode === 'school' && schoolData && schoolResult && (
          <div className="flex flex-col gap-3" aria-live="polite">
            {query.trim() && <p className="text-sm text-fog-300" data-search-count={schoolResult.total}>{schoolResult.total === 0 ? t('ui.search.school.none') : schoolResult.total > schoolResult.hits.length ? t('ui.search.school.countMore', { n: fmt(schoolResult.total), shown: fmt(schoolResult.hits.length) }) : t('ui.search.school.count', { n: fmt(schoolResult.total) })}</p>}
            <ul className="flex flex-col gap-2">
              {schoolResult.hits.map((hit) => {
                const g = hit.group
                const names = [...new Set(g.members.flatMap((m) => [displayName(m, locale), m.name.en, m.name.zhHant, m.name.original]).filter((x): x is string => Boolean(x)))]
                const primaryName = displayName(g.primary, locale)
                const others = names.filter((x) => x !== primaryName).slice(0, 2)
                const moe = g.members.find((m) => m.scheme === 'moe')
                const hk = g.members.find((m) => m.scheme === 'hkmotw')
                const gras = g.members.find((m) => m.scheme === 'gras')
                const crs = g.members.find((m) => m.scheme === 'crs')
                const slug = gras ? schoolData.overseasSlug.get(gras.id.replace(/^gras:/, '')) : undefined
                const place = moe?.province ? provinceLabel(moe.province) : regionLabel(g.primary.region)
                return (
                  <li key={g.key} className="border border-ink-800 bg-ink-900/78 rounded-ctl px-4 py-3 flex flex-col gap-2" data-search-hit={g.members.map((m) => m.id).join(' ')}>
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                      <h2 className="serif text-lg leading-snug">{primaryName}{others.length ? <span className="text-fog-500 text-sm"> · {others.join(' · ')}</span> : null}</h2>
                      <p className="text-xs mono text-fog-500">{place}</p>
                    </div>
                    <p className="text-xs text-fog-500 flex flex-wrap gap-x-2 gap-y-1">
                      {g.members.map((m) => <span key={m.id} className="border border-ink-700 rounded-ctl px-2 py-0.5" data-search-layer={m.scheme}>{t(`ui.search.layer.${m.scheme}`)}</span>)}
                      {hit.via !== 'name' && <span data-search-via={hit.via}>{t(`ui.search.via.${hit.via}`, { name: hit.matched })}</span>}
                    </p>
                    {/* 批 G8：海外機構有研究抽出的英語要求／國際生年學費時，列出原文摘要 */}
                    {gras && slug && <OverseasRequirements id={gras.id.replace(/^gras:/, '')} compact />}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mono">
                      {moe?.siteRoute && <button type="button" onClick={() => go(moe.siteRoute!)} className="tap underline hover:text-accent-500" data-search-open="school">{t('ui.search.open.school')}</button>}
                      {hk && <button type="button" onClick={() => go('#/hkmotw')} className="tap underline hover:text-accent-500" data-search-open="hkmotw">{t('ui.search.open.hkmotw')}</button>}
                      {gras && slug && <button type="button" onClick={() => go(`#/overseas/${encodeURIComponent(slug)}/${encodeURIComponent(gras.id.replace(/^gras:/, ''))}`)} className="tap underline hover:text-accent-500" data-search-open="overseas">{t('ui.search.open.overseas')}</button>}
                      {gras && <button type="button" onClick={() => go('#/world')} className="tap underline hover:text-accent-500" data-search-open="world">{t('ui.search.open.world')}</button>}
                      {crs && !moe && g.partOf.map((id) => schoolData.byId.get(id)).filter((r): r is SearchRecord => Boolean(r?.siteRoute)).slice(0, 2).map((r) => (
                        <button key={r.id} type="button" onClick={() => go(r.siteRoute!)} className="tap underline hover:text-accent-500" data-search-open="partner">{t('ui.search.open.partner', { name: displayName(r, locale) })}</button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {mode === 'major' && majorData && (
          <div className="flex flex-col gap-5">
            {query.trim() && majorHits.length === 0 && <p className="text-sm text-fog-300" data-search-count="0">{t('ui.search.major.none')}</p>}
            {majorHits.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('ui.search.major.hits')}>
                {majorHits.slice(0, 16).map((h) => {
                  const active = target && hitKey(h) === (target.kind === 'program' ? `p:${target.programCode}` : `c:${target.classCode}`)
                  return (
                    <button key={hitKey(h)} type="button" aria-pressed={Boolean(active)} onClick={() => { setPicked(hitKey(h)); setMainlandLimit(30) }} data-major-hit={hitKey(h)}
                      className={['px-3 min-h-[44px] rounded-ctl border text-sm text-left', active ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100'].join(' ')}>
                      {h.target.name} <span className="mono text-xs text-fog-500">{h.target.kind === 'class' ? t('ui.search.major.kind.class') : h.target.programCode}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {target && mainland && (
              <section className="flex flex-col gap-3" data-major-mainland={target.kind === 'program' ? target.programCode : target.classCode}>
                <h2 className="serif text-xl">{t('ui.search.major.mainland.title', { name: target.name })}</h2>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <label className="inline-flex items-center gap-2">
                    <span className="text-fog-500">{t('ui.search.major.province')}</span>
                    <select value={province} onChange={(e) => { setProvince(e.target.value); setMainlandLimit(30) }} className="rounded-ctl border border-ink-700 bg-ink-950 px-2 min-h-[44px] text-fog-100" data-search-province>
                      <option value="">{t('ui.search.major.allProvinces')}</option>
                      {provinces.map((p) => <option key={p} value={p}>{provinceLabel(p)}</option>)}
                    </select>
                  </label>
                </div>
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm text-fog-500 mb-1">{t('ui.search.major.subjects')}</legend>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECT_OPTIONS.map(({ code }) => (
                      <button key={code} type="button" aria-pressed={combo.includes(code)} onClick={() => toggleSubject(code)} data-search-subject={code}
                        className={['px-3 min-h-[44px] rounded-ctl border text-sm', combo.includes(code) ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500'].join(' ')}>
                        {subjectLabel(code)}
                      </button>
                    ))}
                  </div>
                </fieldset>
                <p className="text-sm text-fog-300" data-major-count={`${mainland.rows.length}/${mainland.offering}`}>
                  {comboSet ? t('ui.search.major.countCombo', { n: fmt(mainland.offering), m: fmt(mainland.rows.length) }) : t('ui.search.major.count', { n: fmt(mainland.offering) })}
                </p>
                <p className="text-xs text-fog-500 leading-relaxed flex flex-wrap gap-x-2" data-major-sources>
                  <span>{t('ui.search.major.sources', { year: majorData.index.admissionYear })}</span>
                  {Object.entries(majorData.index.provinceSources).sort(([, a], [, b]) => compareProvinces(a.nameZh, b.nameZh)).map(([code, s]) => {
                    const src = majorData.index.sources[s.sourceId]
                    return <a key={code} href={src?.url} target="_blank" rel="noreferrer noopener" className="tap underline hover:text-accent-500">{provinceLabel(s.nameZh)} ↗</a>
                  })}
                </p>
                <ul className="flex flex-col gap-2">
                  {mainland.rows.slice(0, mainlandLimit).map((row) => {
                    const rec = schoolData?.byId.get(`moe:${row.moeCode}`)
                    return (
                      <li key={row.moeCode} className="border border-ink-800 bg-ink-900/78 rounded-ctl px-4 py-3 flex flex-col gap-1" data-major-school={row.moeCode}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                          {rec?.siteRoute
                            ? <button type="button" onClick={() => go(rec.siteRoute!)} className="serif text-base text-left underline decoration-ink-700 hover:text-accent-500 min-h-[40px]">{rec ? displayName(rec, locale) : row.moeCode}</button>
                            : <span className="serif text-base">{row.moeCode}</span>}
                          <span className="text-xs mono text-fog-500">{rec?.province ? provinceLabel(rec.province) : ''}</span>
                        </div>
                        <p className="text-xs text-fog-300">{t('ui.search.major.requirement')}{row.patterns.map(([p, n]) => (n > 1 ? `${requirementLabel(p)} ×${n}` : requirementLabel(p))).join(t('ui.common.listJoiner'))}</p>
                        <p className="text-xs text-fog-500">{t('ui.search.major.sourceTables')}{sortProvinces(row.provinces.map((p) => majorData.index.provinceSources[p]?.nameZh ?? p)).map((name) => provinceLabel(name)).join(t('ui.common.listJoiner'))}</p>
                      </li>
                    )
                  })}
                </ul>
                {mainland.rows.length > mainlandLimit && (
                  <button type="button" onClick={() => setMainlandLimit((x) => x + 30)} className="self-start px-4 min-h-[44px] rounded-ctl border border-ink-700 text-sm text-fog-300 hover:text-fog-100 hover:border-accent-500" data-major-more>
                    {t('ui.search.major.more', { n: fmt(mainland.rows.length - mainlandLimit) })}
                  </button>
                )}
              </section>
            )}
            {target && overseas && (
              <section className="flex flex-col gap-3" data-major-overseas={overseas.subjects.join('|') || 'none'}>
                <h2 className="serif text-xl">{t('ui.search.major.overseas.title')}</h2>
                <p className="text-xs text-fog-500 leading-relaxed">{t('ui.search.major.mapNote')}</p>
                {overseas.subjects.length === 0
                  ? <p className="text-sm text-fog-300" data-major-overseas-none>{t('ui.search.major.overseas.none')}</p>
                  : (
                    <>
                      <p className="text-sm text-fog-300">{t('ui.search.major.overseas.count', { subjects: overseas.subjects.map((code) => { const s = majorData.atlas.subjects.find((x) => x.code === code); return s ? (locale === 'en' ? s.nameEn : locale === 'zh-Hans' ? s.nameZhHans || s.nameZh : s.nameZh) : code }).join(t('ui.common.listJoiner')), n: fmt(overseas.rows.length) })}</p>
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {overseas.rows.map((row) => {
                          const inst = majorData.atlas.institutions.find((i) => i.id === row.id)
                          const slug = schoolData?.overseasSlug.get(row.id)
                          const name = inst ? (locale === 'en' ? inst.nameEn : inst.nameZh || inst.nameEn) : row.id
                          return (
                            <li key={row.id} className="border border-ink-800 bg-ink-900/78 rounded-ctl px-3 py-2 flex flex-col gap-1" data-major-overseas-row={row.id}>
                              {slug
                                ? <button type="button" onClick={() => go(`#/overseas/${encodeURIComponent(slug)}/${encodeURIComponent(row.id)}`)} className="text-left text-sm underline decoration-ink-700 hover:text-accent-500 min-h-[40px]">{name}</button>
                                : <span className="text-sm">{name}</span>}
                              <span className="text-xs mono text-fog-500">{regionLabel(row.region)} · {row.ranks.map(([, rank]) => t('ui.search.major.overseas.rank', { rank })).join(' / ')}</span>
                            </li>
                          )
                        })}
                      </ul>
                    </>
                  )}
              </section>
            )}
          </div>
        )}
        <p className="text-xs text-fog-500 leading-relaxed">{t('ui.search.footnote')}</p>
      </section>
      <SiteFooter width="max-w-3xl" />
    </main>
  )
}
