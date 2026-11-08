import { EvidenceNotice } from './EvidenceNotice'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { MajorSummary, NonUniversityPaths } from './ResultExtras'
import { useEffect, useMemo, useRef, useState } from 'react'
import { loadJointIndex } from '../lib/jointData'
import type { JointIndexPayload } from '../data/jointTypes'
import type { FilterResult, AnswerMap, ExcludeReason, KeptDistribution } from '../engine/filter'
import { suggestRelaxIds, distribute } from '../engine/filter'
import {
  candidateProvinceOptions,
  getAdmissionResourceLinks,
  type CandidateProvince,
} from '../data/admissionAuthorities'
import { buildSchoolTagSpecs } from '../lib/schoolProfile'
import { normalizeSchoolName } from '../lib/schoolName'
import { generateShareImage } from '../lib/share'
import { ShareCard } from './ShareCard'
import { recordUnapplyDownload } from '../lib/bdfzIdentity'
import { allQuestions } from '../data/questions'
import type { ProgramIndexPayload, SubjectCode } from '../data/programsTypes'
import { countAdmissible } from '../engine/programs'
import { programsManifest } from '../data/programsManifest'
import type { OriginRegion } from '../data/origins'
import { MAINLAND_CHANNELS, liveSourceLinks, type OriginPrefs } from '../data/originBranch'
import { participationLists, type ParticipationList } from '../data/participationLists'
import type { FlowPlan } from '../engine/flowPlan'
import { buildGlobalPool, poolFor } from '../engine/globalFilter'
import { loadHkMoTwPool } from '../lib/hkmotwData'
import { loadOverseasIndex } from '../lib/overseasData'
import { useLocale } from '../i18n/react'
import { Rich } from '../i18n/rich'
import { distributionLabel, explainKeptLocalized, formatReason, linkLabel, linkNote, provinceLabel, questionTitle, schoolDisplayName, tagLabel } from '../lib/i18nLabels'

interface Props {
  result: FilterResult
  answers: AnswerMap
  /** 起點、資格與目的地（批 G6）：決定「下一步」與「你這條管道」兩段；不進 AnswerMap。 */
  origin: OriginRegion | null
  originPrefs: OriginPrefs
  plan: FlowPlan
  /** 逐校招生專業摘要：卡片上的專業數與「你的選科可報」計數用（篩選本身已由 S1／S2 題在引擎裡完成）。 */
  programsIndex: ProgramIndexPayload | null
  candidateProvince: CandidateProvince
  onCandidateProvinceChange: (province: CandidateProvince) => void
  onRestart: () => void
  onRelax: () => void
  onSchool: (id: string) => void
  onAbout: () => void
  onContribute: () => void
  onWorld: () => void
  onHkMoTw: () => void
  onOverseas: () => void
  onGlobal: () => void
  onHome: () => void
}

type LookupEntry =
  | { kind: 'kept'; school: FilterResult['kept'][number] }
  | { kind: 'excluded'; school: FilterResult['excluded'][number]['school']; reasons: ExcludeReason[] }

interface NopeHandoffAnswer {
  id: string;
  title: string;
  labels: string[];
  dataStatus: (typeof allQuestions)[number]['dataStatus'];
}

interface NopeHandoffContext {
  version: 'nope.v1';
  source: 'https://nope.bdfz.net/';
  createdAt: string;
  stats: {
    totalInput: number;
    excludedCount: number;
    keptCount: number;
    answeredCount: number;
  };
  answers: NopeHandoffAnswer[];
  keptSamples: string[];
  excludedSamples: { name: string; reasons: string[] }[];
}

function cityTierBadge(tier: string | undefined): string {
  if (tier === 'tier1') return 'T1'
  if (tier === 'newtier1') return 'NT1'
  if (tier === 'tier2') return 'T2'
  if (tier === 'tier3_below') return 'T3-'
  return 'T?'
}

/** gk 交接（nope.v1）固定送 zh-Hant 原文：題目標題、選項文字與排除理由都取引擎字串，不隨介面語言變。 */
function formatReasonForHandoff(reason: ExcludeReason): string {
  return `${reason.questionTitle} · 你選了「${reason.userAnswerLabel}」 · 該校是「${reason.schoolValue}」` // i18n-contract
}

function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function answerLabels(questionId: string, value: AnswerMap[keyof AnswerMap]): string[] {
  if (!value || value === 'skip') return []
  const question = allQuestions.find((item) => item.id === questionId)
  if (!question) return []
  const keys = Array.isArray(value) ? value : [value]
  return keys
    .map((key) => question.options.find((option) => option.key === key)?.label)
    .filter((label): label is string => Boolean(label))
}

function buildHandoffContext(result: FilterResult, answers: AnswerMap): NopeHandoffContext {
  const compactAnswers: NopeHandoffAnswer[] = Object.entries(answers)
    .flatMap(([id, value]) => {
      const question = allQuestions.find((item) => item.id === id)
      const labels = answerLabels(id, value)
      if (!question || labels.length === 0) return []
      return [{
        id,
        title: question.title,
        labels,
        dataStatus: question.dataStatus,
      }]
    })

  return {
    version: 'nope.v1',
    source: 'https://nope.bdfz.net/',
    createdAt: new Date().toISOString(),
    stats: {
      totalInput: result.stats.totalInput,
      excludedCount: result.stats.excludedCount,
      keptCount: result.stats.keptCount,
      answeredCount: result.stats.answeredCount,
    },
    answers: compactAnswers,
    keptSamples: result.kept.slice(0, 18).map((school) => school.name),
    excludedSamples: result.excluded.slice(0, 12).map(({ school, reasons }) => ({
      name: school.name,
      reasons: reasons.slice(0, 3).map(formatReasonForHandoff),
    })),
  }
}

function buildHandoff(result: FilterResult, answers: AnswerMap) {
  const encoded = encodeBase64Url(JSON.stringify(buildHandoffContext(result, answers)))
  return {
    gkUrl: `https://gk.rdfzer.com/?nope=${encoded}#advice-top`,
  }
}

export function ResultPage({
  result,
  answers,
  origin,
  originPrefs,
  plan,
  programsIndex,
  candidateProvince,
  onCandidateProvinceChange: setCandidateProvince,
  onRestart,
  onRelax,
  onSchool,
  onAbout,
  onContribute,
  onWorld,
  onHkMoTw,
  onOverseas,
  onGlobal,
  onHome,
}: Props) {
  const { t } = useLocale()
  // 「參與你這條管道」的官方名單（批 G6）：只對香港起點（文憑試或未答資格）；展示層，不改剩餘計數與學習證據
  const routeList = useMemo<ParticipationList | null>(() => {
    if (origin !== 'hk' || (originPrefs.qualification && originPrefs.qualification !== 'hkdse')) return null
    return Object.values(participationLists).find((list) => list.origin === 'hk') ?? null
  }, [origin, originPrefs.qualification])
  const listedIds = useMemo(() => new Set(routeList?.schoolIds ?? []), [routeList])
  // 「只看名單內」是本分頁的檢視偏好：返回／前進、重新載入後保持（sessionStorage）
  const [onlyListed, setOnlyListedState] = useState(() => { try { return window.sessionStorage.getItem('unapply.onlyListed.v1') === '1' } catch { return false } })
  const setOnlyListed = (update: (value: boolean) => boolean) => setOnlyListedState((value) => {
    const next = update(value)
    try { if (next) window.sessionStorage.setItem('unapply.onlyListed.v1', '1'); else window.sessionStorage.removeItem('unapply.onlyListed.v1') } catch { /* 存不下就算了 */ }
    return next
  })
  const shareRef = useRef<HTMLDivElement>(null)
  const [downloading, setDownloading] = useState(false)
  const [schoolQuery, setSchoolQuery] = useState('')

  const finalKept = result.kept
  // S1 的答案是固定序組合鍵（'PCB'）：卡片上順手算「你的選科可報幾個」。
  const chosenSubjects = useMemo(() => {
    const combo = answers.S1
    return typeof combo === 'string' && combo !== 'skip' && combo.length === 3 ? new Set([...combo] as SubjectCode[]) : null
  }, [answers.S1])
  const dist = useMemo(() => distribute(finalKept), [finalKept])
  // 題目標題隨語言變；計算便宜，不用 useMemo（避免把 locale 放進假依賴）。
  const relaxHints = suggestRelaxIds(result.stats, 3).map((id) => questionTitle(id))
  const listedKept = useMemo(() => (routeList ? finalKept.filter((school) => listedIds.has(school.id)) : []), [finalKept, listedIds, routeList])
  const shownKept = routeList && onlyListed ? listedKept : finalKept
  const topKept = shownKept.slice(0, 24)
  // 中外合作辦學計數（教育部監管平台）：結果頁才載入的小索引；載不到就不顯示。
  const [jointIndex, setJointIndex] = useState<JointIndexPayload | null>(null)
  useEffect(() => {
    let alive = true
    loadJointIndex().then((payload) => { if (alive) setJointIndex(payload) }).catch(() => undefined)
    return () => { alive = false }
  }, [])
  const jointLine = (school: FilterResult['kept'][number]): string | null => {
    const entry = school.moeCode && jointIndex ? jointIndex.schools[school.moeCode] : undefined
    if (!entry) return null
    const parts = [entry.i > 0 ? t('ui.result.jointLine.institutions', { i: entry.i }) : '', entry.p > 0 ? t('ui.result.jointLine.projects', { p: entry.p }) : ''].filter(Boolean).join(t('ui.result.jointLine.partsJoiner'))
    const extras = [entry.hk > 0 ? t('ui.result.jointLine.hk', { hk: entry.hk }) : '', entry.fi > 0 ? t('ui.result.jointLine.fi', { fi: entry.fi }) : ''].filter(Boolean).join(t('ui.common.listJoiner'))
    return t('ui.result.jointLine.summary', { parts, extras: extras ? t('ui.common.parenthetical', { text: extras }) : '', live: entry.live < entry.i + entry.p ? t('ui.result.jointLine.live', { live: entry.live }) : '' })
  }
  const programLine = (school: FilterResult['kept'][number]): string | null => {
    const entry = school.moeCode && programsIndex ? programsIndex.schools[school.moeCode] : undefined
    if (!entry) return null
    const year = programsManifest.admissionYear
    if (entry.u === 0) return t('ui.result.programLine.vocationalOnly', { year, v: entry.v })
    const vocational = entry.v > 0 ? t('ui.result.programLine.alsoVocational', { v: entry.v }) : ''
    if (chosenSubjects) return t('ui.result.programLine.withSubjects', { year, u: entry.u, admissible: countAdmissible(entry, chosenSubjects, programsIndex!), vocational })
    return t('ui.result.programLine.noSubjects', { year, u: entry.u, vocational })
  }

  const lookupResults = useMemo(() => {
    const query = schoolQuery.trim()
    if (!query) return [] as LookupEntry[]
    const normalizedQuery = normalizeSchoolName(query)
    const keptMatches: LookupEntry[] = finalKept.map((school) => ({ kind: 'kept', school }))
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
          entry.school.nameEn ?? '',
          entry.school.province,
          entry.school.city,
        ].map((value) => normalizeSchoolName(value))
        return haystacks.some((value) => value.includes(normalizedQuery) || (normalizedQuery.length > 2 && value.toLowerCase().includes(normalizedQuery.toLowerCase())))
      })
      .sort((left, right) => {
        const leftExact = normalizeSchoolName(left.school.name) === normalizedQuery ? 1 : 0
        const rightExact = normalizeSchoolName(right.school.name) === normalizedQuery ? 1 : 0
        return rightExact - leftExact
      })
      .slice(0, 8)
  }, [finalKept, result.excluded, schoolQuery])
  const handoff = useMemo(() => buildHandoff(result, answers), [answers, result])

  const share = async () => {
    if (!shareRef.current) return
    setDownloading(true)
    await generateShareImage(shareRef.current, `unapply-${Date.now()}.png`)
    void recordUnapplyDownload({
      recordKind: 'download',
      recordKey: `share-${Date.now().toString(36)}`,
      title: '下載了「我的不考大學樣本」分享圖', // i18n-contract
      summary: `劃掉 ${result.stats.excludedCount}，剩 ${result.stats.keptCount}`, // i18n-contract
    })
    setDownloading(false)
  }

  const zero = finalKept.length === 0
  const shortlistReached = result.stats.answeredCount > 0 && result.stats.keptCount <= 10
  const showRelaxAction = !zero && result.stats.answeredCount > 0

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <SiteHeader sticky width="max-w-3xl" brand={t('ui.result.brand')} actions={[{ label: t('ui.common.contribute'), onClick: onContribute }]} />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24 sm:pt-12 flex flex-col gap-10 sm:gap-14">
        <EvidenceNotice />
        <div className="flex flex-col gap-4">
          <p className="mono text-xs text-fog-500 uppercase tracking-[0.3em]">{t('ui.result.kicker')}</p>
          <h1 className="serif text-3xl sm:text-5xl leading-tight">
            <Rich k="ui.result.headline" params={{ total: result.stats.totalInput, excluded: result.stats.excludedCount }} />
          </h1>
          <p className="text-fog-300 text-base">
            <Rich k="ui.result.remaining" params={{ kept: <span className="text-lg">{finalKept.length}</span> }} />
            {result.stats.answeredCount === 0 && t('ui.result.nothingAnswered')}
          </p>
          {shortlistReached && (
            <div className="max-w-2xl rounded-2xl border border-accent-500/30 bg-ink-900/80 px-4 py-4 text-sm text-fog-300 leading-relaxed">
              {zero ? t('ui.result.shortlist.zero') : t('ui.result.shortlist.few', { kept: result.stats.keptCount })}
            </div>
          )}
        </div>

        {zero && (
          <div className="bg-ink-900 border border-accent-600/50 rounded-2xl p-6 flex flex-col gap-3">
            <p className="serif text-lg">{t('ui.result.zero.title')}</p>
            <p className="text-sm text-fog-300">
              {t('ui.result.zero.note')}
              {relaxHints.map((hint, index) => (
                <span key={index} className="block mt-1 text-fog-500">· {hint}</span>
              ))}
            </p>
            <button
              onClick={onRestart}
              className="self-start px-5 py-2 rounded-full bg-accent-500 text-ink-950 font-semibold text-sm hover:bg-accent-400"
            >
              {t('ui.common.restart')}
            </button>
          </div>
        )}

        {!zero && (
          <div className="grid sm:grid-cols-2 gap-6">
            <DistCard title={t('ui.result.dist.byProvince')} kind="byProvince" items={dist.byProvince.slice(0, 8)} />
            <DistCard title={t('ui.result.dist.byLevel')} kind="byLevel" items={dist.byLevel} />
          </div>
        )}

        {!zero && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <h2 className="serif text-xl">{t('ui.result.kept.title')}</h2>
                <p className="mt-2 text-xs text-fog-500 leading-relaxed">
                  {t('ui.result.kept.note')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="mono text-xs text-fog-500 uppercase tracking-[0.2em] shrink-0">{t('ui.common.candidateProvince')}</span>
                <select
                  value={candidateProvince}
                  onChange={(e) => setCandidateProvince(e.target.value as CandidateProvince)}
                  className="bg-ink-900 border border-ink-700 rounded-full px-3 py-2 text-xs text-fog-200 min-h-[40px]"
                >
                  {candidateProvinceOptions.map((province) => (
                    <option key={province} value={province}>{provinceLabel(province)}</option>
                  ))}
                </select>
              </div>
            </div>
            {routeList && (
              <div className="flex flex-wrap items-center gap-3 border border-ink-800 bg-ink-900 rounded-xl px-4 py-3" data-route-list={routeList.id}>
                <p className="text-sm text-fog-300 leading-relaxed flex-1 min-w-[12rem]">{t('ui.result.route.listLine', { year: routeList.year, count: routeList.count, kept: finalKept.length, listed: listedKept.length })}</p>
                <button type="button" aria-pressed={onlyListed} onClick={() => setOnlyListed((v) => !v)} data-route-only-listed
                  className={['px-4 min-h-[44px] rounded-full border text-sm', onlyListed ? 'border-accent-500 bg-accent-500/10 text-fog-100' : 'border-ink-700 bg-ink-950 text-fog-300 hover:border-fog-500 hover:text-fog-100'].join(' ')}>
                  {t('ui.result.route.onlyListed')}
                </button>
              </div>
            )}
            {routeList && onlyListed && listedKept.length === 0 && <p className="text-sm text-fog-300" data-route-listed-empty>{t('ui.result.route.listedEmpty')}</p>}
            <div className="grid gap-3 sm:grid-cols-2">
              {topKept.map((school) => (
                <div
                  key={school.id}
                  className="bg-ink-900 border border-ink-700 rounded-xl p-4 flex flex-col gap-4 hover:border-accent-500 transition-colors"
                >
                  <button onClick={() => onSchool(school.id)} className="text-left">
                    <div className="flex items-start justify-between gap-3">
                      <span className="serif text-base">{schoolDisplayName(school)}</span>
                      <span className="mono text-xs text-fog-500 uppercase tracking-wider mt-1 shrink-0">
                        {cityTierBadge(school.cityTier)}
                      </span>
                    </div>
                    {routeList && listedIds.has(school.id) && <p className="mt-2 text-xs text-fog-100" data-route-listed>{t('ui.result.route.badge', { year: routeList.year })}</p>}
                    <p className="mt-2 text-xs text-fog-500">{explainKeptLocalized(school)}</p>
                    {programLine(school) && <p className="mt-1 text-xs text-fog-300">{programLine(school)}</p>}
                    {jointLine(school) && <p className="mt-1 text-xs text-fog-500">{jointLine(school)}</p>}
                  </button>
                  <TagRail tags={buildSchoolTagSpecs(school, { candidateProvince }).map(tagLabel)} />
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-ink-800">
                    {getAdmissionResourceLinks(school, candidateProvince).map((link) => (
                      <a
                        key={`${school.id}-${link.labelKey}`}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className={[
                          'px-3 py-2 rounded-full text-xs mono min-h-[40px] inline-flex items-center',
                          link.kind === 'official'
                            ? 'bg-accent-500/12 text-accent-400 border border-accent-500/30'
                            : 'bg-ink-950 text-fog-300 border border-ink-700 hover:border-fog-500',
                        ].join(' ')}
                        title={linkNote(link)}
                      >
                        {linkLabel(link)} ↗
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-fog-500 leading-relaxed">
              {t('ui.result.portalsNote')}
            </p>
          </div>
        )}

        {/* 批 G7：剩下學校的專業（按專業類彙總，不改剩下的）；非大學路徑（中國大陸已核企業直招） */}
        {!zero && <MajorSummary kept={finalKept} programsIndex={programsIndex} combo={chosenSubjects} schoolName={schoolDisplayName} onSchool={onSchool} />}
        <NonUniversityPaths destinations={['cn-mainland']} inlineQuestion />

        {(origin === 'hk' || origin === 'mo' || origin === 'tw') && <YourRoute origin={origin} list={routeList} />}

        <NextStage plan={plan} origin={origin} onGlobal={onGlobal} onHome={onHome} />

        <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <h2 className="serif text-xl">{t('ui.result.lookup.title')}</h2>
            <p className="mt-2 text-sm text-fog-500 leading-relaxed">
              {t('ui.result.lookup.note')}
            </p>
          </div>
          <input
            value={schoolQuery}
            onChange={(e) => setSchoolQuery(e.target.value)}
            placeholder={t('ui.result.lookup.placeholder')}
            className="w-full bg-ink-950 border border-ink-700 rounded-xl px-4 py-3 text-sm text-fog-100 placeholder:text-fog-500"
          />
          {!schoolQuery.trim() && (
            <p className="text-xs text-fog-500 leading-relaxed">
              {t('ui.result.lookup.hint')}
            </p>
          )}
          {schoolQuery.trim() && lookupResults.length === 0 && (
            <p className="text-sm text-fog-500 leading-relaxed">
              {t('ui.result.lookup.noMatch')}
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
                        <h3 className="serif text-lg break-words">{schoolDisplayName(entry.school)}</h3>
                      </button>
                      <p className="mt-1 text-xs text-fog-500">{provinceLabel(entry.school.province)} · {entry.school.city}</p>
                    </div>
                    <span
                      className={[
                        'shrink-0 rounded-full px-3 py-1 text-xs mono border',
                        entry.kind === 'kept'
                          ? 'border-accent-500/40 text-accent-400 bg-accent-500/10'
                          : 'border-ink-700 text-fog-300 bg-ink-900',
                      ].join(' ')}
                    >
                      {entry.kind === 'kept' ? t('ui.result.lookup.kept') : t('ui.result.lookup.excluded', { n: entry.reasons.length })}
                    </span>
                  </div>
                  <TagRail tags={buildSchoolTagSpecs(entry.school, { candidateProvince }).map(tagLabel)} />
                  {entry.kind === 'kept' ? (
                    <p className="text-sm text-fog-300 leading-relaxed">
                      {t('ui.result.lookup.keptReason', { explain: explainKeptLocalized(entry.school) })}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-sm text-fog-300 leading-relaxed">{t('ui.result.lookup.excludedReasons')}</p>
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

        <div className="bg-ink-900 border border-ink-800 rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <p className="mono text-xs uppercase tracking-[0.24em] text-fog-500">{t('ui.result.ai.kicker')}</p>
            <h2 className="serif text-xl">{t('ui.result.ai.title')}</h2>
            <p className="mt-2 text-sm text-fog-500 leading-relaxed">
              {t('ui.result.ai.note')}
            </p>
          </div>
          <div className="grid gap-3">
            <a
              href={handoff.gkUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="px-5 py-4 border border-accent-500/40 bg-accent-500/10 text-accent-600 rounded-xl text-sm hover:bg-accent-500/15 min-h-[56px] flex items-center justify-between gap-3"
            >
              <span>{t('ui.result.ai.cta')}</span>
              <span className="mono text-xs">gk.rdfzer.com ↗</span>
            </a>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div ref={shareRef}>
            <ShareCard result={result} />
          </div>
          <p className="text-sm text-fog-400 leading-relaxed">
            {t('ui.result.share.note')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={share}
              disabled={downloading}
              className="px-6 py-3 bg-accent-500 text-ink-950 rounded-full font-semibold text-sm hover:bg-accent-400 disabled:opacity-50 min-h-[48px]"
            >
              {downloading ? t('ui.result.share.generating') : t('ui.result.share.download')}
            </button>
            {showRelaxAction && (
              <button
                onClick={onRelax}
                className="px-6 py-3 border border-fog-500 text-fog-100 rounded-full text-sm hover:border-accent-500 hover:text-accent-500 min-h-[48px]"
              >
                {t('ui.result.relax')}
              </button>
            )}
            <button
              onClick={onContribute}
              className="px-6 py-3 border border-ink-700 text-fog-300 rounded-full text-sm hover:text-fog-100 min-h-[48px]"
            >
              {t('ui.common.contributeData')}
            </button>
            <button
              onClick={onRestart}
              className="px-6 py-3 border border-ink-700 text-fog-500 rounded-full text-sm hover:text-fog-100 min-h-[48px]"
            >
              {t('ui.common.restart')}
            </button>
          </div>
        </div>

        <footer className="mt-8 pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
          <p>{t('ui.result.footer.basis')}</p>
          <p>{t('ui.result.footer.presumption')}</p>
          <p>
            <Rich
              k="ui.result.footer.links"
              slots={{
                a1: (children) => <button onClick={onAbout} className="hover:text-accent-500 underline">{children}</button>,
                a2: (children) => <button onClick={onContribute} className="hover:text-accent-500 underline">{children}</button>,
                a3: (children) => <button onClick={onWorld} className="hover:text-accent-500 underline">{children}</button>,
                a4: (children) => <button onClick={onHkMoTw} className="hover:text-accent-500 underline">{children}</button>,
                a5: (children) => <button onClick={onOverseas} className="hover:text-accent-500 underline">{children}</button>,
              }}
            />
          </p>
        </footer>
      </section>
      <SiteFooter width="max-w-3xl" />
    </main>
  )
}

/**
 * 你這條管道（批 G6）：港澳臺起點進大陸高校的官方管道；有官方參與院校名單的（香港文憑試收生計劃）標出名單與計數，
 * 取不到名單的只放官方說明鏈接（live 才鏈，鏈接文字用機構名）並註明。
 */
function YourRoute({ origin, list }: { origin: 'hk' | 'mo' | 'tw'; list: ParticipationList | null }) {
  const { t } = useLocale()
  return (
    <section className="flex flex-col gap-3" data-your-route={origin}>
      <h2 className="serif text-xl">{t('ui.result.route.title')}</h2>
      <ul className="flex flex-col gap-2">
        {MAINLAND_CHANNELS[origin].map((channel) => {
          const links = liveSourceLinks(channel.sources)
          const hasList = list && list.channel === channel.id
          return (
            <li key={channel.id} className="border border-ink-800 bg-ink-900 rounded-xl px-4 py-3 flex flex-col gap-1" data-route-channel={channel.id}>
              <p className="text-sm text-fog-100 leading-snug">{t(`ui.channels.${channel.key}.title`)}</p>
              <p className="text-xs text-fog-500 leading-relaxed">{hasList ? t('ui.result.route.listed', { year: list.year, count: list.count }) : t('ui.result.route.noList')}</p>
              {(links.length > 0 || hasList) && (
                <p className="text-xs mono text-fog-500 flex flex-wrap items-center gap-x-2">
                  <span>{t('ui.branch.officialInfo')}</span>
                  {hasList && <a className="inline-flex items-center min-h-[40px] underline hover:text-accent-500" href={list.source.url} target="_blank" rel="noreferrer noopener">{t('ui.result.route.listPdf', { publisher: t(`ui.source.${list.source.publisher}`) })} ↗</a>}
                  {links.map(({ url, org }) => <a key={url} className="inline-flex items-center min-h-[40px] underline hover:text-accent-500" href={url} target="_blank" rel="noreferrer noopener">{t(`ui.source.${org}`)} ↗</a>)}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * 下一步（批 G6，裁定 B）：目的地含港澳臺或海外時，大陸剩餘之後是「下一步：…減法（池 N 所）」主按鈕；
 * 只選中國大陸時，一行說明可回首頁加選目的地。池數由與 #/global 同一套引擎算（去重、扣除官方不招本科的）。
 */
function NextStage({ plan, origin, onGlobal, onHome }: { plan: FlowPlan; origin: OriginRegion | null; onGlobal: () => void; onHome: () => void }) {
  const { t, n } = useLocale()
  const hasGlobal = plan.stages.includes('global')
  const destinationsKey = plan.globalDestinations.join('|')
  const [pool, setPool] = useState<number | null>(null)
  useEffect(() => {
    if (!hasGlobal) return
    let alive = true
    Promise.all([loadOverseasIndex(), loadHkMoTwPool()])
      .then(([overseas, hkmotw]) => { if (alive) setPool(poolFor(buildGlobalPool(overseas, hkmotw), destinationsKey.split('|') as FlowPlan['globalDestinations'], origin).length) })
      .catch(() => { if (alive) setPool(null) })
    return () => { alive = false }
  }, [hasGlobal, destinationsKey, origin])
  const places = plan.globalDestinations.map((d) => t(`ui.dest.${d}`)).join(t('ui.common.listJoiner'))
  if (!hasGlobal) {
    return (
      <div className="flex flex-col gap-2" data-next-stage="none">
        <p className="text-sm text-fog-300 leading-relaxed">
          {t('ui.result.next.onlyMainland')}{' '}
          <button type="button" onClick={onHome} className="underline hover:text-accent-500 min-h-[40px]">{t('ui.result.next.addDestinations')}</button>
        </p>
        <p className="text-xs text-fog-500 leading-relaxed">{t('ui.result.next.note')}</p>
      </div>
    )
  }
  return (
    <section className="border border-accent-500/40 bg-accent-500/10 rounded-2xl p-5 flex flex-col gap-3" data-next-stage="global">
      <h2 className="serif text-xl">{t('ui.result.next.title', { places })}</h2>
      <p className="text-xs text-fog-500 leading-relaxed">{t('ui.result.next.note')}</p>
      <button type="button" onClick={onGlobal} data-next-stage-go className="self-start px-6 min-h-[48px] rounded-xl bg-accent-500 text-ink-950 font-semibold text-base hover:bg-accent-400">
        {pool === null ? t('ui.result.next.go') : t('ui.result.next.goPool', { n: n(pool) })} →
      </button>
    </section>
  )
}

function DistCard({ title, kind, items }: { title: string; kind: keyof KeptDistribution; items: { label: string; code: string; count: number }[] }) {
  const max = items[0]?.count ?? 1
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-xl p-5">
      <h3 className="serif text-base mb-4">{title}</h3>
      <ul className="flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.code} className="flex items-center gap-3 text-sm">
            <span className="w-20 text-fog-300 truncate shrink-0">{distributionLabel(kind, it)}</span>
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
          className="rounded-full border border-ink-700 bg-ink-950 px-3 py-1 text-xs text-fog-300"
        >
          {tag}
        </span>
      ))}
    </div>
  )
}
