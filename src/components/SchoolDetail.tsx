import type { School } from '../data/schools'
import { DIMENSIONS, DIMENSION_GROUPS } from '../data/dimensions'

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

export function SchoolDetail({ school, onBack }: Props) {
  const qualityDims = DIMENSION_GROUPS.B
  return (
    <main className="min-h-screen bg-ink-950 text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={onBack} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500">
            ← 返回
          </button>
          <span className="mono text-xs text-fog-500">學校詳情</span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-10 pb-24 flex flex-col gap-10">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 text-xs mono text-fog-500 uppercase tracking-[0.2em]">
            <span>{levelLabel[school.level] ?? school.level}</span>
            <span>·</span>
            <span>{tierLabel[school.cityTier] ?? school.cityTier}</span>
          </div>
          <h1 className="serif text-4xl sm:text-5xl">{school.name}</h1>
          {school.nameEn && <p className="mono text-sm text-fog-500">{school.nameEn}</p>}
          <p className="text-fog-300 text-sm mt-2">
            {school.province} · {school.city} · {school.type} · {campusLabel[school.mainCampusType]}
          </p>
          {school.tags?.length ? (
            <div className="flex flex-wrap gap-2 mt-2">
              {school.tags.map(t => (
                <span key={t} className="text-xs text-fog-500 border border-ink-700 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          ) : null}
          {school.website && (
            <a
              href={school.website}
              target="_blank"
              rel="noreferrer noopener"
              className="mono text-xs text-accent-500 hover:text-accent-400 mt-1"
            >
              {school.website} ↗
            </a>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="serif text-xl">24 維生活質量</h2>
          <p className="text-xs text-fog-500">
            未填 = 眾包暫未覆蓋，引擎不會以該維度排除此校。
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {qualityDims.map(d => {
              const meta = DIMENSIONS[d]
              const val = school.quality?.[d]
              return (
                <div key={d} className="bg-ink-900 border border-ink-800 rounded-lg p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="serif text-sm">{meta.label}</span>
                    <span className="mono text-[10px] text-fog-500">{d}</span>
                  </div>
                  <p className={['mt-2 text-sm', val ? 'text-fog-100' : 'text-fog-500'].join(' ')}>
                    {val ?? '待眾包'}
                  </p>
                  {meta.authoritativeSources[0] && (
                    <a
                      href={meta.authoritativeSources[0].url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-2 block text-[10px] mono text-fog-500 hover:text-accent-500 truncate"
                    >
                      來源 ↗
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <footer className="pt-6 border-t border-ink-800 text-xs mono text-fog-500 leading-relaxed">
          <p>權威來源：教育部學科評估 · CollegesChat 眾包問卷 · 第一財經城市等級。</p>
          <p className="mt-1">所有維度展示為中性事實，勸退與否由用戶自己的偏好決定。</p>
        </footer>
      </section>
    </main>
  )
}
