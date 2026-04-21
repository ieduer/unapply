import { useEffect, useState } from 'react'
import type { School } from '../data/schools'
import { DIMENSIONS, DIMENSION_GROUPS } from '../data/dimensions'
import type { DimensionId } from '../data/dimensions'
import type { CampusResearchRecord, ResearchEvidence } from '../data/runtimeTypes'
import {
  candidateProvinceOptions,
  defaultCandidateProvince,
  getAdmissionResourceLinks,
  type CandidateProvince,
} from '../data/admissionAuthorities'
import { getEnvironment } from '../data/environment'
import { loadCampusesByProvince } from '../lib/runtimeData'

interface Props {
  school: School
  onBack: () => void
}

const levelLabel: Record<string, string> = {
  'C9': 'C9 聯盟',
  '985非C9': '985（非 C9）',
  '211非985': '211（非 985）',
  '雙一流非211': '雙一流（非 211）',
  '普通本科': '普通本科',
  '專科': '專科',
}

const tierLabel: Record<string, string> = {
  tier1: '一線城市',
  newtier1: '新一線城市',
  tier2: '二線城市',
  tier3_below: '三線及以下',
}

const campusLabel: Record<string, string> = {
  main_city: '主城主校區',
  suburb_with_metro: '遠郊有地鐵',
  suburb: '遠郊無地鐵',
  separate_freshman: '大一單獨分校',
}

const freshmanPolicyLabel: Record<string, string> = {
  yes: '大一單獨落在分校',
  no: '不是僅大一分校',
  unknown: '本科新生去向待核',
}

const envLabel = {
  heating: { yes: '有集中供暖', no: '無集中供暖' },
  summer: { mild: '夏天涼爽', hot: '夏天乾熱', humid_hot: '夏天濕熱', extreme_hot: '夏天酷熱' },
  winter: { warm: '冬天溫暖', mild: '冬天偶冷', cold: '冬天常結冰', extreme_cold: '冬天極寒' },
  haze: { low: '空氣好', medium: '霧霾中等', high: '霧霾較重', extreme: '重度霧霾' },
  subway: { yes: '有地鐵', no: '無地鐵' },
  coastal: { yes: '沿海', no: '內陸' },
  highland: { yes: '高海拔', no: '平原/丘陵' },
} as const

const confidenceLabel: Record<string, string> = {
  high: '高置信',
  medium: '中置信',
  low: '低置信',
}

function contribHref(schoolId: string, dim: DimensionId): string {
  return `#/contribute?school=${encodeURIComponent(schoolId)}&dim=${dim}`
}

export function SchoolDetail({ school, onBack }: Props) {
  const [candidateProvince, setCandidateProvince] = useState<CandidateProvince>(defaultCandidateProvince)
  const [campusMap, setCampusMap] = useState<Record<string, CampusResearchRecord[]>>({})
  const qualityDims = DIMENSION_GROUPS.B
  const env = getEnvironment(school.province, school.city)
  const levelText = school.level ? (levelLabel[school.level] ?? school.level) : '層次待核'
  const tierText = school.cityTier ? (tierLabel[school.cityTier] ?? school.cityTier) : '城市等級待核'
  const typeText = school.type ?? school.moeLevel ?? '類型待補'
  const campusText = school.mainCampusType ? (campusLabel[school.mainCampusType] ?? school.mainCampusType) : '校區待補'
  const hasCampusResolution = !school.moeCode || Object.hasOwn(campusMap, school.moeCode)
  const campusList = school.moeCode ? (campusMap[school.moeCode] ?? []) : []
  const officialA5Evidence = school.researchEvidence?.A5 ?? []
  const officialB9Evidence = school.researchEvidence?.B9 ?? []
  const metroRaw = school.quality?.B9
  const metroText = Array.isArray(metroRaw) ? metroRaw.join(' / ') : metroRaw
  const officialMetroText = officialB9Evidence.length > 0 ? metroText : null
  const freshmanPolicyText = school.campusFreshmanPolicy
    ? (freshmanPolicyLabel[school.campusFreshmanPolicy] ?? school.campusFreshmanPolicy)
    : null

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
        setCampusMap((current) => {
          if (Object.hasOwn(current, school.moeCode!)) return current
          return {
            ...current,
            [school.moeCode!]: [],
          }
        })
      })

    return () => {
      cancelled = true
    }
  }, [campusMap, school.moeCode, school.province])

  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <button onClick={onBack} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] -my-3 py-3">
            ← 返回
          </button>
          <span className="mono text-xs text-fog-500">學校詳情</span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs mono text-fog-500 uppercase tracking-[0.2em]">
            <span>{levelText}</span>
            <span>·</span>
            <span>{tierText}</span>
          </div>
          <h1 className="serif text-3xl sm:text-5xl">{school.name}</h1>
          {school.nameEn && <p className="mono text-sm text-fog-500">{school.nameEn}</p>}
          <p className="text-fog-300 text-sm mt-2">
            {school.province} · {school.city} · {typeText} · {campusText}
          </p>
          {school.schoolAddress && (
            <p className="text-xs text-fog-500 leading-relaxed">
              校址：{school.schoolAddress}
            </p>
          )}
          {school.tags?.length ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {school.tags.map(t => (
                <span key={t} className="text-xs text-fog-500 border border-ink-700 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h2 className="serif text-xl">官方與權威查詢</h2>
              <p className="mt-2 text-xs text-fog-500 leading-relaxed">
                給出學校官網、陽光高考院校庫，以及你所選考生地區的權威錄取/分數線入口。
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
          <div className="flex flex-wrap gap-2">
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
                    : 'bg-ink-900 text-fog-300 border border-ink-700 hover:border-fog-500',
                ].join(' ')}
                title={link.note}
              >
                {link.label} ↗
              </a>
            ))}
          </div>
          <p className="text-xs text-fog-500 leading-relaxed">
            已接入 31 個省級官方招考入口；北京同時提供近年錄取/分數線直鏈，其他省份將持續補齊直達查詢頁。
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h2 className="serif text-xl">校區 · 研究補全</h2>
              <p className="mt-2 text-xs text-fog-500 leading-relaxed">
                校區明細先用 GitHub 結構化底稿聚合；只有已核到學校級官方依據的 A5/B9 條目才直接參與硬篩選。
              </p>
            </div>
            <a
              href={contribHref(school.id, 'A5')}
              className="mono text-xs text-accent-500 hover:text-accent-400 shrink-0"
            >
              補校區 →
            </a>
          </div>

          {(school.mainCampusType || freshmanPolicyText || officialMetroText || officialA5Evidence.length > 0 || officialB9Evidence.length > 0) && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <EvidenceChip label={`A5：${campusText}`} />
                {freshmanPolicyText && <EvidenceChip label={`本科新生：${freshmanPolicyText}`} />}
                {officialMetroText && <EvidenceChip label={`B9：${officialMetroText}`} />}
              </div>
              {officialA5Evidence.length > 0 && (
                <EvidenceRow label="A5 官方依據" items={officialA5Evidence} />
              )}
              {officialB9Evidence.length > 0 && (
                <EvidenceRow label="B9 官方依據" items={officialB9Evidence} />
              )}
            </div>
          )}

          {!hasCampusResolution && (
            <p className="text-xs text-fog-500 leading-relaxed">正在載入校區資料…</p>
          )}

          {hasCampusResolution && campusList.length === 0 && (
            <p className="text-xs text-fog-500 leading-relaxed">
              校區資料補充中；當前只把已核到學校級官方依據的 A5/B9 條目拿去排除，其餘底稿只展示不誤殺。點上方入口可直接補充。
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
                    <span className="mono text-[10px] text-fog-500">
                      {confidenceLabel[campus.confidence ?? 'low'] ?? '低置信'}
                    </span>
                  </div>
                  {campus.campusAddress && (
                    <p className="text-sm text-fog-200 leading-relaxed">{campus.campusAddress}</p>
                  )}
                  <p className="text-xs text-fog-500">
                    {[campus.province, campus.city, campus.district].filter(Boolean).join(' · ') || '地理信息待補'}
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
            <h2 className="serif text-xl">環境 · 權威推導</h2>
            <p className="text-xs text-fog-500 leading-relaxed">
              以下由省份+城市直接推導，來源於氣象局／生態環境部／城市軌道交通協會，不接受眾包修改。
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <EnvChip label={envLabel.heating[env.heating]} />
              <EnvChip label={envLabel.summer[env.summer]} />
              <EnvChip label={envLabel.winter[env.winter]} />
              <EnvChip label={envLabel.haze[env.haze]} />
              <EnvChip label={envLabel.subway[env.subwayCity]} />
              <EnvChip label={envLabel.coastal[env.coastal]} />
              <EnvChip label={envLabel.highland[env.highland]} />
              <EnvChip label={env.dialect} />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="serif text-xl">24 維生活質量 · 眾包</h2>
            <a
              href={contribHref(school.id, 'B1')}
              className="mono text-xs text-accent-500 hover:text-accent-400 shrink-0"
            >
              全部補充 →
            </a>
          </div>
          <p className="text-xs text-fog-500 leading-relaxed">
            未填 = 眾包暫未覆蓋，引擎不會以該維度排除此校。點擊每張卡片補一條數據到 GitHub。
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {qualityDims.map(d => {
              const meta = DIMENSIONS[d]
              const rawValue = school.quality?.[d]
              const val = Array.isArray(rawValue) ? rawValue.join(' / ') : rawValue
              return (
                <a
                  key={d}
                  href={contribHref(school.id, d)}
                  className="bg-ink-900 border border-ink-800 rounded-lg p-4 block hover:border-accent-600 transition-colors group"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="serif text-sm">{meta.label}</span>
                    <span className="mono text-[10px] text-fog-500">{d}</span>
                  </div>
                  <p className={['mt-2 text-sm', val ? 'text-fog-100' : 'text-fog-500 italic'].join(' ')}>
                    {val ?? '待補充 · 點此貢獻'}
                  </p>
                  {meta.authoritativeSources[0] && (
                    <span className="mt-2 block text-[10px] mono text-fog-500 truncate">
                      {meta.authoritativeSources[0].title.slice(0, 20)}
                    </span>
                  )}
                </a>
              )
            })}
          </div>
        </div>

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
          <p>權威來源：教育部名單 · 氣象局氣候分區 · 生態環境部 · 城市軌道交通協會 · 第一財經。</p>
          <p className="mt-1">眾包來源：CollegesChat · 用戶貢獻（CC BY-NC-SA 4.0）。</p>
          <p className="mt-1">所有維度展示為中性事實，勸退與否由用戶自己的偏好決定。</p>
        </footer>
      </section>
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
    <span className="inline-flex items-center rounded-full border border-ink-700 bg-ink-900 px-3 py-2 text-[11px] text-fog-300">
      {label}
    </span>
  )
}

function EvidenceRow({ label, items }: { label: string; items: ResearchEvidence[] }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="mono text-[10px] text-fog-500 uppercase tracking-[0.2em]">{label}</span>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <a
            key={`${label}-${item.title}-${item.url}`}
            href={item.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex max-w-full items-center rounded-full border border-ink-700 bg-ink-900 px-3 py-2 text-[11px] text-fog-300 hover:border-fog-500"
            title={item.note}
          >
            <span className="truncate">
              {item.title}
              {item.date ? ` · ${item.date}` : ''}
              {item.confidence ? ` · ${confidenceLabel[item.confidence] ?? item.confidence}` : ''}
            </span>
            <span className="ml-1 shrink-0">↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}
