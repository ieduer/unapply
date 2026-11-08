import { useEffect, useMemo, useState } from 'react'
import type { School } from '../data/schools'
import { DIMENSION_GROUPS } from '../data/dimensions'
import type { DimensionId } from '../data/dimensions'
import type { CampusResearchRecord, ResearchEvidence } from '../data/runtimeTypes'
import {
  candidateProvinceOptions,
  getAdmissionResourceLinks,
  type CandidateProvince,
} from '../data/admissionAuthorities'
import { getEnvironment } from '../data/environment'
import { isHardFilterableQuality } from '../engine/filter'
import { loadCampusesByProvince } from '../lib/runtimeData'
import { getRegularChannelState } from '../lib/schoolProfile'
import { loadProgramBucket } from '../lib/programsData'
import type { ProgramIndexPayload, ProgramOffering, SubjectCode } from '../data/programsTypes'
import type { AnswerMap } from '../engine/filter'
import { evaluateSchoolPrograms, isAdmissible } from '../engine/programs'
import { programPrefsActive, type ProgramPrefs } from '../data/programPrefs'
import { programClassByCode } from '../data/programClasses'
import { programsManifest } from '../data/programsManifest'
import { loadJointItems } from '../lib/jointData'
import type { JointItem } from '../data/jointTypes'
import { jointProgramsManifest } from '../data/jointProgramsManifest'
import { TierBadge } from './TierBadge'
import { useLocale } from '../i18n/react'
import { dimensionLabel, linkLabel, linkNote, programStrikeLabel, provinceLabel, requirementLabel, schoolDisplayName, subjectsLabel, valueLabel } from '../lib/i18nLabels'
import { SiteHeader } from './SiteHeader'

interface Props {
  school: School
  /** 逐校招生專業摘要（問卷前置資料）；詳情頁另按省分桶載完整清單。 */
  programsIndex: ProgramIndexPayload | null
  /** 目前的作答：S1（選科組合）與 S2（意向專業類）用來給出逐校判定文字。 */
  answers: AnswerMap
  candidateProvince: CandidateProvince
  onCandidateProvinceChange: (province: CandidateProvince) => void
  onBack: () => void
}

function contribHref(schoolId: string, dim: DimensionId): string {
  return `#/contribute?school=${encodeURIComponent(schoolId)}&dim=${dim}`
}

export function SchoolDetail({ school, programsIndex, answers, candidateProvince, onCandidateProvinceChange: setCandidateProvince, onBack }: Props) {
  const { t, tOr, locale } = useLocale()
  const [campusMap, setCampusMap] = useState<Record<string, CampusResearchRecord[]>>({})
  // 由 S1／S2 的作答組成判定偏好（與引擎的 requires 判定同義）。
  const programPrefs = useMemo<ProgramPrefs>(() => {
    const combo = answers.S1
    const klass = answers.S2
    return {
      subjects: typeof combo === 'string' && combo !== 'skip' && combo.length === 3 ? ([...combo] as SubjectCode[]) : [],
      intent: typeof klass === 'string' && klass !== 'skip' && programClassByCode[klass] ? { classCode: klass, className: programClassByCode[klass].name } : null,
    }
  }, [answers.S1, answers.S2])
  // App 把逐校摘要當問卷前置資料，進到詳情頁時一定已載入；這裡只是沿用原本的 {prefs,index} 形狀。
  const programs = useMemo(() => ({ prefs: programPrefs, index: programsIndex }), [programPrefs, programsIndex])
  const [showAllPrograms, setShowAllPrograms] = useState(false)
  const [programList, setProgramList] = useState<{ moeCode: string; programs: ProgramOffering[] } | null>(null)
  const [programListError, setProgramListError] = useState(false)
  const programEntry = programs.index && school.moeCode ? programs.index.schools[school.moeCode] : undefined
  const programVerdict = useMemo(() => (programs.index ? evaluateSchoolPrograms(programEntry, programs.prefs, programs.index) : null), [programEntry, programs.index, programs.prefs])
  const strongBase = programs.index && school.moeCode ? programs.index.strongBase.find((row) => row.moeCode === school.moeCode) : undefined
  const chosenSubjects = programs.prefs.subjects.length === 3 ? new Set(programs.prefs.subjects) : null
  useEffect(() => {
    if (!programEntry || !school.moeCode || programListError) return
    if (programList && programList.moeCode === school.moeCode) return
    let alive = true
    loadProgramBucket(school.province)
      .then((bucket) => { if (alive) setProgramList({ moeCode: school.moeCode!, programs: bucket[school.moeCode!] ?? [] }) })
      .catch(() => { if (alive) setProgramListError(true) })
    return () => { alive = false }
  }, [programEntry, programList, programListError, school.moeCode, school.province])
  const programSources = useMemo(() => {
    if (!programs.index || !programEntry) return [] as ResearchEvidence[]
    const payload = programs.index
    const rows: ResearchEvidence[] = programEntry.p.split('|')
      .map((tag) => payload.provinceSources[tag])
      .filter((item): item is { sourceId: string; nameZh: string } => Boolean(item))
      .map((item) => {
        const source = payload.sources[item.sourceId]
        return { title: t('ui.detail.programs.sourceTitle', { province: provinceLabel(item.nameZh), publisher: source.publisher, year: payload.admissionYear }), url: source.url, date: source.date, confidence: 'high' as const }
      })
    const catalog = payload.sources['moe-bk-catalog-2026']
    if (catalog) rows.push({ title: t('ui.detail.programs.catalogTitle', { year: payload.catalogYear }), url: catalog.url, date: catalog.date, confidence: 'high' })
    return rows
  }, [programEntry, programs.index, t])
  const programsPayload = programs.index
  // 已納入交叉核對的省表（來自 payload，省數隨來源增加而變）。
  const programProvinceNames = programsPayload ? Object.values(programsPayload.provinceSources).map((item) => provinceLabel(item.nameZh)) : []
  const programProvinceList = programProvinceNames.length > 0 ? programProvinceNames.join(t('ui.common.listJoiner')) : t('ui.detail.programs.provincesFallback')
  const currentList = programList && programList.moeCode === school.moeCode ? programList.programs : null
  const programGroups = useMemo(() => {
    if (!currentList) return [] as { level: 'u' | 'v'; campus: string; programs: ProgramOffering[] }[]
    const groups = new Map<string, { level: 'u' | 'v'; campus: string; programs: ProgramOffering[] }>()
    for (const program of currentList) {
      const key = `${program.l}|${program.c}`
      const group = groups.get(key) ?? groups.set(key, { level: program.l, campus: program.c, programs: [] }).get(key)!
      group.programs.push(program)
    }
    return [...groups.values()].sort((a, b) => a.level.localeCompare(b.level) || (a.campus === '' ? -1 : b.campus === '' ? 1 : a.campus.localeCompare(b.campus)))
  }, [currentList])
  // 中外合作辦學（教育部監管平台）：只在詳情頁載入；載不到就不顯示，不影響其他區塊。
  const [jointItems, setJointItems] = useState<JointItem[] | null>(null)
  const [jointError, setJointError] = useState(false)
  useEffect(() => {
    if (!school.moeCode) return
    let alive = true
    loadJointItems().then((payload) => { if (alive) setJointItems(payload.items[school.moeCode!] ?? []) }).catch(() => { if (alive) setJointError(true) })
    return () => { alive = false }
  }, [school.moeCode])
  const qualityDims = DIMENSION_GROUPS.B
  const admissionChannels = school.admissionChannels
  const regularChannelState = getRegularChannelState(school, { candidateProvince })
  const env = getEnvironment(school.province, school.city)
  const levelText = school.level ? tOr(`ui.detail.level.${school.level}`, school.level) : t('ui.detail.tierPending')
  const [campusLoadError, setCampusLoadError] = useState(false)
  const [campusRetry, setCampusRetry] = useState(0)
  const tierText = school.cityTier ? tOr(`ui.detail.tier.${school.cityTier}`, tOr(`tag.cityTier.${school.cityTier}`, school.cityTier)) : t('ui.detail.cityTierPending')
  const typeText = school.type ? tOr(`tag.type.${school.type}`, school.type) : (school.moeLevel ?? t('ui.detail.typePending'))
  const campusText = school.mainCampusType ? tOr(`ui.detail.campus.${school.mainCampusType}`, school.mainCampusType) : t('ui.detail.campusPending')
  const hasCampusResolution = !school.moeCode || Object.hasOwn(campusMap, school.moeCode)
  const campusList = school.moeCode ? (campusMap[school.moeCode] ?? []) : []
  const officialA5Evidence = school.researchEvidence?.A5 ?? []
  const officialB9Evidence = school.researchEvidence?.B9 ?? []
  const metroRaw = school.quality?.B9
  const metroText = Array.isArray(metroRaw) ? metroRaw.map((v) => valueLabel('B9', v)).join(' / ') : metroRaw ? valueLabel('B9', metroRaw) : undefined
  const officialMetroText = officialB9Evidence.length > 0 ? metroText : null
  const freshmanPolicyText = school.campusFreshmanPolicy
    ? tOr(`ui.detail.freshman.${school.campusFreshmanPolicy}`, school.campusFreshmanPolicy)
    : null
  const provinceLine = `${provinceLabel(school.province)} · ${school.city} · ${typeText} · ${campusText}`
  const programLimit = programGroups.length > 1 ? 12 : 30

  useEffect(() => {
    let cancelled = false

    if (!school.moeCode) {
      return () => {
        cancelled = true
      }
    }
    if (Object.hasOwn(campusMap, school.moeCode)) {
      return () => {
        cancelled = true
      }
    }

    void loadCampusesByProvince(school.province)
      .then((bucket) => {
        if (cancelled) return
        setCampusMap((current) => {
          if (Object.hasOwn(current, school.moeCode!)) return current
          return {
            ...current,
            [school.moeCode!]: bucket[school.moeCode!] ?? [],
          }
        })
      })
      .catch(() => {
        if (cancelled) return
        setCampusLoadError(true)
      })

    return () => {
      cancelled = true
    }
  }, [campusMap, school.moeCode, school.province, campusRetry])

  return (
    <main className="min-h-screen app-canvas text-fog-100 page-end-space">
      <SiteHeader sticky width="max-w-3xl" brand={t('ui.detail.header')} back={{ label: t('ui.common.back'), onClick: onBack }} />

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs mono text-fog-500 uppercase tracking-[0.2em]">
            <span>{levelText}</span>
            <span>·</span>
            <span>{tierText}</span>
          </div>
          <h1 className="serif text-3xl sm:text-5xl">{locale === 'zh-Hans' ? schoolDisplayName(school) : school.name}</h1>
          {school.nameEn && <p className="mono text-sm text-fog-500">{school.nameEn}</p>}
          <p className="text-fog-300 text-sm mt-2">
            {provinceLine}
          </p>
          {school.schoolAddress && (
            <p className="text-xs text-fog-500 leading-relaxed">
              {t('ui.detail.address', { address: school.schoolAddress })}
            </p>
          )}
          {school.tags?.length ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {school.tags.map(tag => (
                <span key={tag} className="text-xs text-fog-500 border border-ink-700 px-2 py-1 rounded-full">{tag}</span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="serif text-xl">{t('ui.detail.officialLookup.title')}</h2>
              <p className="mt-2 text-xs text-fog-500 leading-relaxed">
                {t('ui.detail.officialLookup.note')}
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
          <div className="flex flex-wrap gap-2">
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
                    : 'bg-ink-900 text-fog-300 border border-ink-700 hover:border-fog-500',
                ].join(' ')}
                title={linkNote(link)}
              >
                {linkLabel(link)} ↗
              </a>
            ))}
          </div>
          <p className="text-xs text-fog-500 leading-relaxed">
            {t('ui.detail.officialLookup.portalsNote')}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="serif text-xl">{t('ui.detail.channels.title')}</h2>
          {admissionChannels ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-fog-200 leading-relaxed">
                {regularChannelState === 'comprehensive_only' && t('ui.detail.channels.comprehensiveOnly', { province: provinceLabel(candidateProvince) })}
                {regularChannelState === 'comprehensive_dominant' && t('ui.detail.channels.comprehensiveDominant', { province: provinceLabel(candidateProvince) })}
                {regularChannelState === 'regular' && t('ui.detail.channels.regular', { province: provinceLabel(candidateProvince) })}
              </p>
              {admissionChannels.notes && (
                <p className="text-xs text-fog-500 leading-relaxed">{admissionChannels.notes}</p>
              )}
              <a
                href={admissionChannels.source.url}
                target="_blank"
                rel="noreferrer noopener"
                className="tap mono text-xs text-accent-500 hover:text-accent-400 break-all"
              >
                {admissionChannels.source.title}
                {admissionChannels.year ? t('ui.detail.channels.sourceYear', { year: admissionChannels.year }) : ''} ↗
              </a>
            </div>
          ) : (
            <p className="text-xs text-fog-500 leading-relaxed">
              {t('ui.detail.channels.notRecorded')}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <h2 className="serif text-xl">{t('ui.detail.programs.title', { year: programsManifest.admissionYear })}</h2>
            <p className="mt-2 text-xs text-fog-500 leading-relaxed">
              {t('ui.detail.programs.note', { n: programProvinceNames.length, provinces: programProvinceList })}
            </p>
          </div>
          {!programs.index && (
            <p className="text-sm text-fog-500">{t('ui.detail.programs.loading')}</p>
          )}
          {programs.index && !programEntry && (
            <p className="text-xs text-fog-500 leading-relaxed">
              {t('ui.detail.programs.notInTables', { year: programsManifest.admissionYear, n: programProvinceNames.length, provinces: programProvinceList })}
            </p>
          )}
          {programsPayload && programEntry && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2">
                {programEntry.u > 0 && <EvidenceChip label={t('ui.detail.programs.chip.undergrad', { u: programEntry.u })} />}
                {programEntry.u > 0 && <EvidenceChip label={t('ui.detail.programs.chip.mapped', { n: programEntry.u - programEntry.x })} />}
                {programEntry.v > 0 && <EvidenceChip label={t('ui.detail.programs.chip.vocational', { v: programEntry.v })} />}
                {programGroups.some((g) => g.campus) && <EvidenceChip label={t('ui.detail.programs.chip.campuses', { list: [...new Set(programGroups.filter((g) => g.campus).map((g) => g.campus))].join(t('ui.common.listJoiner')) })} />}
                {strongBase && <EvidenceChip label={t('ui.detail.programs.chip.strongBase', { since: strongBase.since })} />}
              </div>
              {strongBase && programsPayload.sources[strongBase.sourceId] && (
                <a
                  href={programsPayload.sources[strongBase.sourceId].url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="tap mono text-xs text-accent-500 hover:text-accent-400 break-all"
                >
                  {programsPayload.sources[strongBase.sourceId].title}（{programsPayload.sources[strongBase.sourceId].date}） ↗
                </a>
              )}
              {programPrefsActive(programs.prefs) && programVerdict && (
                <div className="rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-sm text-fog-200 leading-relaxed flex flex-col gap-1">
                  <span className="mono text-xs uppercase tracking-[0.2em] text-fog-500">{t('ui.detail.programs.verdict.kicker')}</span>
                  {programVerdict.state === 'kept' && (
                    <span>
                      {programs.prefs.intent ? t('ui.detail.programs.verdict.offers', { wanted: programs.prefs.intent.programName ?? programs.prefs.intent.className, n: programVerdict.matchingCount }) : t('ui.detail.programs.verdict.count', { n: programVerdict.matchingCount })}
                      {chosenSubjects ? t('ui.detail.programs.verdict.admissible', { subjects: subjectsLabel(programs.prefs.subjects), n: programVerdict.admissibleCount }) : t('ui.detail.programs.verdict.period')}
                    </span>
                  )}
                  {programVerdict.state === 'struck' && programVerdict.reasons.map((reason) => <span key={reason.kind}>{t('ui.detail.programs.verdict.struck', { reason: programStrikeLabel(reason) })}</span>)}
                  {programVerdict.state === 'unknown' && (
                    <span>{t('ui.detail.programs.verdict.unknown', { wanted: programs.prefs.intent?.programName ?? programs.prefs.intent?.className ?? '', n: programVerdict.experimental })}</span>
                  )}
                  {programVerdict.state === 'no-data' && <span>{t('ui.detail.programs.verdict.noData')}</span>}
                </div>
              )}
              {!currentList && !programListError && <p className="text-sm text-fog-500">{t('ui.detail.programs.listLoading')}</p>}
              {programListError && <p className="text-sm text-fog-300">{t('ui.detail.programs.listFailed')}</p>}
              <div className="flex flex-col gap-3">
                {programGroups.map((group) => {
                  const visible = showAllPrograms ? group.programs : group.programs.slice(0, programLimit)
                  const heading = [group.level === 'v' ? t('ui.detail.programs.vocationalHeading') : '', group.campus].filter(Boolean).join(' · ')
                  return (
                    <div key={`${group.level}-${group.campus || 'main'}`} className="flex flex-col gap-2">
                      {heading && <span className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">{heading}</span>}
                      <ul className="grid gap-2 sm:grid-cols-2">
                        {visible.map((program) => {
                          const admissible = chosenSubjects && program.l === 'u' ? isAdmissible(program.r, chosenSubjects) : null
                          return (
                            <li key={`${program.c}-${program.n}`} className="rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-xs flex flex-col gap-1">
                              <span className="text-fog-100 text-sm">{program.n}</span>
                              <span className="text-fog-500">
                                {requirementLabel(program.r)}
                                {program.m === 'class' ? t('ui.detail.programs.matchClass') : program.m === 'none' ? t('ui.detail.programs.matchNone') : program.m === 'vocational' ? t('ui.detail.programs.matchVocational') : ''}
                              </span>
                              {admissible !== null && (
                                <span className={admissible ? 'text-accent-500' : 'text-fog-300'}>{admissible ? t('ui.detail.programs.admissible') : t('ui.detail.programs.notAdmissible')}</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
                {!showAllPrograms && programGroups.some((g) => g.programs.length > programLimit) && (
                  <button
                    onClick={() => setShowAllPrograms(true)}
                    className="self-start px-4 py-2 rounded-full border border-ink-700 text-xs text-fog-300 hover:text-fog-100 hover:border-fog-500 min-h-[44px]"
                  >
                    {t('ui.detail.programs.showAll', { n: currentList?.length ?? 0 })}
                  </button>
                )}
              </div>
              {programSources.length > 0 && <EvidenceRow label={t('ui.common.source')} items={programSources} />}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="serif text-xl">{t('ui.detail.campus.title')}</h2>
              <p className="mt-2 text-xs text-fog-500 leading-relaxed">
                {t('ui.detail.campus.note')}
              </p>
            </div>
            <a
              href={contribHref(school.id, 'A5')}
              className="tap mono text-xs text-accent-500 hover:text-accent-400 shrink-0"
            >
              {t('ui.detail.campus.addCta')}
            </a>
          </div>

          {(school.mainCampusType || freshmanPolicyText || officialMetroText || officialA5Evidence.length > 0 || officialB9Evidence.length > 0) && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <EvidenceChip label={t('ui.detail.campus.chipA5', { campus: campusText })} />
                {freshmanPolicyText && <EvidenceChip label={t('ui.detail.campus.chipFreshman', { policy: freshmanPolicyText })} />}
                {officialMetroText && <EvidenceChip label={t('ui.detail.campus.chipB9', { metro: officialMetroText })} />}
              </div>
              {officialA5Evidence.length > 0 && (
                <EvidenceRow label={t('ui.detail.campus.evidenceA5')} items={officialA5Evidence} />
              )}
              {officialB9Evidence.length > 0 && (
                <EvidenceRow label={t('ui.detail.campus.evidenceB9')} items={officialB9Evidence} />
              )}
            </div>
          )}

          {campusLoadError && <p role="alert">{t('ui.detail.campus.loadFailed')}<button onClick={() => { setCampusLoadError(false); setCampusRetry((n) => n + 1) }}>{t('ui.detail.campus.retry')}</button></p>}
          {!hasCampusResolution && !campusLoadError && (
            <p className="text-xs text-fog-500 leading-relaxed">{t('ui.detail.campus.loading')}</p>
          )}

          {hasCampusResolution && campusList.length === 0 && (
            <p className="text-xs text-fog-500 leading-relaxed">
              {t('ui.detail.campus.empty')}
            </p>
          )}

          {hasCampusResolution && campusList.length > 0 && (
            <div className="grid gap-3">
              {campusList.map((campus) => (
                <div
                  key={`${school.id}-${campus.campusName}-${campus.campusAddress ?? ''}`}
                  className="bg-ink-900 border border-ink-800 rounded-lg p-4 flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="serif text-sm">{campus.campusName}</span>
                    <span className="mono text-xs text-fog-500">
                      {tOr(`ui.detail.confidence.${campus.confidence ?? 'low'}`, t('ui.detail.confidence.low'))}
                    </span>
                  </div>
                  {campus.campusAddress && (
                    <p className="text-sm text-fog-200 leading-relaxed">{campus.campusAddress}</p>
                  )}
                  <p className="text-xs text-fog-500">
                    {[campus.province ? provinceLabel(campus.province) : '', campus.city, campus.district].filter(Boolean).join(' · ') || t('ui.detail.campus.geoPending')}
                  </p>
                  {campus.notes && (
                    <p className="text-xs text-fog-500 leading-relaxed">{campus.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {env && (
          <div className="flex flex-col gap-4">
            <h2 className="serif text-xl">{t('ui.detail.env.title')}</h2>
            <p className="text-xs text-fog-500 leading-relaxed">
              {t('ui.detail.env.note')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <EnvChip label={t(`ui.detail.env.heating.${env.heating ? 'yes' : 'no'}`)} />
              <EnvChip label={t(`ui.detail.env.summer.${env.summer}`)} />
              <EnvChip label={t(`ui.detail.env.winter.${env.winter}`)} />
              <EnvChip label={t(`ui.detail.env.haze.${env.haze}`)} />
              <EnvChip label={t(`ui.detail.env.subway.${env.subwayCity ? 'yes' : 'no'}`)} />
              <EnvChip label={t(`ui.detail.env.coastal.${env.coastal ? 'yes' : 'no'}`)} />
              <EnvChip label={t(`ui.detail.env.highland.${env.highland ? 'yes' : 'no'}`)} />
              <EnvChip label={valueLabel('E5', env.dialect)} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="serif text-xl">{t('ui.detail.life.title')}</h2>
            <a
              href={contribHref(school.id, 'B1')}
              className="tap mono text-xs text-accent-500 hover:text-accent-400 shrink-0"
            >
              {t('ui.detail.life.addAll')}
            </a>
          </div>
          <p className="text-xs text-fog-500 leading-relaxed">
            {t('ui.detail.life.note')}
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {qualityDims.map(d => {
              const rawValue = school.quality?.[d]
              const val = Array.isArray(rawValue) ? rawValue.map((v) => valueLabel(d, v)).join(' / ') : rawValue ? valueLabel(d, rawValue) : undefined
              const evidence = school.qualityEvidence?.[d]
              const filterable = val != null && isHardFilterableQuality(school, d)
              const crowdValues = Object.entries(evidence?.valueCounts ?? {})
              const sources = school.researchEvidence?.[d] ?? []
              return (
                <div
                  key={d}
                  className="bg-ink-900 border border-ink-800 rounded-lg p-4 block hover:border-accent-600 transition-colors group"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="serif text-sm">{dimensionLabel(d)}</span>
                    <span className="mono text-xs text-fog-500">{d}</span>
                  </div>
                  <p className={['mt-2 text-sm', val ? 'text-fog-100' : 'text-fog-500 italic'].join(' ')}>
                    {evidence?.source === 'crowd' && crowdValues.length > 1 ? t('ui.detail.life.inconsistent') : evidence?.source === 'crowd' && val ? t('ui.detail.life.unverified', { value: val }) : val ?? t('ui.detail.life.pending')}
                  </p>
                  {evidence && (
                    <span
                      className={[
                        'mt-2 inline-block text-xs mono',
                        filterable ? 'text-fog-500' : 'text-fog-300',
                      ].join(' ')}
                    >
                      {evidence.source === 'crowd'
                        ? t('ui.detail.life.crowdMeta', { n: evidence.sampleSize, classified: evidence.classifiedSampleSize ?? evidence.sampleSize })
                        : `${evidence.scope === 'school' ? t('ui.detail.life.officialSchoolWide') : t('ui.detail.life.officialCampusOnly')}${evidence.year ? ` · ${evidence.year}` : ''}`}
                    </span>
                  )}
                  {evidence?.source === 'crowd' && (
                    <p className="mt-2 text-xs text-fog-500">{crowdValues.map(([value, votes]) => t('ui.detail.life.votes', { value: valueLabel(d, value), votes })).join('；')}{t('ui.detail.life.unclassified', { n: evidence.unclassifiedResponses ?? 0 })}</p>
                  )}
                  {evidence?.source === 'crowd' && <p className="mt-2 text-xs text-fog-500">{t('ui.detail.life.crowdSource')}</p>}
                  {sources.map((source, i) => (
                    <div key={source.url + i} className="mt-2 text-xs text-fog-500">
                      <a className="text-accent-500 underline" href={source.url} target="_blank" rel="noreferrer noopener">{source.title}</a> <TierBadge url={source.url} />
                      <p>{source.date ?? t('ui.detail.life.sourceDateMissing')} · {source.note}</p>
                    </div>
                  ))}
                  <a className="tap mt-3 text-xs text-accent-500" href={contribHref(school.id, d)}>{t('ui.detail.life.addOne')}</a>
                </div>
              )
            })}
          </div>
        </div>

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
          <p>{t('ui.detail.footer.authoritative')}</p>
          <p className="mt-1">{t('ui.detail.footer.crowd')}</p>
          <p className="mt-1">{t('ui.detail.footer.caveat')}</p>
        </footer>
      </section>
      {school.moeCode && (jointItems === null ? null : (jointItems.length > 0 || jointError) && (
        <section className="border border-ink-800 bg-ink-900/78 backdrop-blur-xl rounded-xl p-5 sm:p-6 flex flex-col gap-4">
          <div>
            <h2 className="serif text-xl">{t('ui.detail.joint.title')}</h2>
            <p className="mt-2 text-xs text-fog-500 leading-relaxed">
              {t('ui.detail.joint.note', { note: jointProgramsManifest.source.note })}
            </p>
          </div>
          {jointError && <p className="text-sm text-fog-300">{t('ui.detail.joint.loadFailed')}</p>}
          {jointItems.length > 0 && (
            <ul className="flex flex-col gap-3">
              {jointItems.map((item) => (
                <li key={item.id} className="border border-ink-800 bg-ink-950 rounded-lg px-3 py-3 flex flex-col gap-1.5 text-sm">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="mono text-xs uppercase tracking-[0.16em] text-fog-500">{item.kind === 'institution' ? t('ui.detail.joint.institution') : t('ui.detail.joint.project')}{item.coop === 'mainland_hkmotw' ? t('ui.detail.joint.hkmotw') : item.coop === 'foreign_independent' ? t('ui.detail.joint.foreignIndependent') : ''}</span>
                    {item.status !== 'listed' && <span className="rounded-full border border-ink-700 px-2 py-0.5 text-xs text-fog-300">{item.annotation || item.status}</span>}
                  </div>
                  <p className="text-fog-100 leading-snug">{item.name}</p>
                  <p className="text-xs text-fog-300 leading-relaxed">
                    {item.foreign && <>{item.coop === 'mainland_hkmotw' ? t('ui.detail.joint.partnerHkmotw') : t('ui.detail.joint.partnerForeign')}：{item.foreign}</>}
                    {item.level && <> · {item.level}</>}
                    {item.enrolmentYears && <>{t('ui.detail.joint.enrolmentYears', { years: item.enrolmentYears })}</>}
                  </p>
                  {item.programs && <p className="text-xs text-fog-300 leading-relaxed">{t('ui.detail.joint.programs', { programs: item.programs })}</p>}
                  <p className="text-xs mono text-fog-500 break-all">
                    {item.licenseKind}{item.licenseKind ? ' ' : ''}{item.licenseNo}{item.validUntil ? t('ui.detail.joint.validUntil', { date: item.validUntil }) : ''} ·{' '}
                    <a className="underline hover:text-accent-500" href={item.url} target="_blank" rel="noreferrer noopener">{t('ui.detail.joint.platformLink')}</a> · {t('ui.detail.joint.fetched', { date: item.fetchedAt })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  )
}

function EnvChip({ label }: { label: string }) {
  return (
    <div className="bg-ink-900 border border-ink-800 rounded-lg px-3 py-2 text-xs text-fog-300 text-center">
      {label}
    </div>
  )
}

function EvidenceChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-fog-300">
      {label}
    </span>
  )
}

function EvidenceRow({ label, items }: { label: string; items: ResearchEvidence[] }) {
  const { tOr } = useLocale()
  return (
    <div className="flex flex-col gap-2">
      <span className="mono text-xs text-fog-500 uppercase tracking-[0.2em]">{label}</span>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <a
            key={`${label}-${item.title}-${item.url}`}
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full items-center min-h-[40px] rounded-full border border-ink-700 bg-ink-900 px-3 py-2 text-xs text-fog-300 hover:border-fog-500"
            title={item.note}
          >
            <span className="truncate">
              {item.title}
              {item.date ? ` · ${item.date}` : ''}
              {item.confidence ? ` · ${tOr(`ui.detail.confidence.${item.confidence}`, item.confidence)}` : ''}
            </span>
            <TierBadge url={item.url} className="ml-1 shrink-0" />
            <span className="ml-1 shrink-0">↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}
