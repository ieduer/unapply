import {
  officialSchoolCount,
  officialUndergraduateCount,
  officialVocationalCount,
} from '../data/schoolCatalogSummary'
import { contributionHighlights, researchSummary } from '../data/researchSummary'
import { motion } from 'motion/react'

interface Props {
  onStart: () => void
  onAbout: () => void
  onContribute: () => void
}

export function Landing({ onStart, onAbout, onContribute }: Props) {
  return (
    <main className="min-h-screen app-canvas text-fog-100 flex flex-col items-center justify-between px-5 sm:px-6 py-6 sm:py-10">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-5xl flex items-center justify-between text-[10px] sm:text-xs mono uppercase tracking-[0.2em] sm:tracking-[0.25em] text-fog-500"
      >
        <span>nope.bdfz.net · v1.6</span>
        <button
          onClick={onAbout}
          className="hover:text-accent-500 transition-colors min-h-[44px] -my-3 py-3 px-2"
        >
          about
        </button>
      </motion.div>

      <section className="w-full max-w-5xl flex flex-1 flex-col justify-center gap-8 sm:gap-12 py-10 sm:py-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <p className="mono text-xs uppercase tracking-[0.28em] text-accent-500">減法人生 · 學校版</p>
          <h1 className="mt-5 serif text-5xl sm:text-7xl leading-none text-fog-100">
            你一定不考哪所大學
          </h1>
          <p className="mt-6 max-w-2xl text-base sm:text-lg text-fog-300 leading-relaxed">
            不告訴你該考哪所，只幫你從官方目錄裡先劃掉不能忍的那批。
          </p>
          <p className="mt-4 mono text-sm text-fog-500">
            {officialSchoolCount.toLocaleString()} 所普通高校 · 本科 {officialUndergraduateCount.toLocaleString()} · 高職專科 {officialVocationalCount.toLocaleString()}
          </p>
        </motion.div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          <button
            onClick={onStart}
            className="px-7 py-4 sm:py-3 bg-accent-500 text-ink-950 rounded-xl font-semibold text-base hover:bg-accent-400 transition-colors min-h-[52px]"
          >
            開始減法
          </button>
          <span className="text-xs mono text-fog-500">按當前有效數據動態出題 · 可隨時跳過</span>
        </div>

        <div className="grid border-y border-ink-800 bg-ink-900/70 backdrop-blur-xl sm:grid-cols-3">
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

        <div className="border border-ink-800 bg-ink-900/78 p-5 sm:p-6 flex flex-col gap-4 backdrop-blur-xl">
          <div className="flex flex-col gap-2">
            <p className="mono text-[11px] uppercase tracking-[0.24em] text-fog-500">用戶貢獻數據</p>
            <h2 className="serif text-2xl">無學生，不學校</h2>
            <p className="text-sm text-fog-400 leading-relaxed">
              既然所謂官方信息向來少⋯⋯不如，一起來；辛苦提交先進 GitHub issue，審核後再入庫。
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
              className="px-5 py-3 rounded-xl border border-accent-500/40 bg-accent-500/10 text-accent-600 text-sm hover:bg-accent-500/15 min-h-[48px]"
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

      <footer className="w-full max-w-5xl pt-6 border-t border-ink-800">
        <div className="grid gap-3 sm:gap-2">
          <FooterGroup
            label="姊妹站"
            items={[
              { href: 'https://path.bdfz.net', text: 'path · 職業減法' },
              { href: 'https://gk.rdfzer.com/#advice-top', text: 'gk · 高考報考' },
              { href: 'https://my.bdfz.net', text: 'my · 用戶中心' },
            ]}
          />
          <FooterGroup
            label="權威數據"
            items={[
              { href: 'https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html', text: '教育部' },
              { href: 'https://www.cma.gov.cn/', text: '氣象局' },
              { href: 'https://www.yicai.com/topic/100311963/', text: '第一財經' },
              { href: 'https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/', text: '學科評估' },
            ]}
          />
          <FooterGroup
            label="開源與貢獻"
            items={[
              { href: 'https://github.com/ieduer/unapply', text: 'ieduer/unapply' },
              { href: 'https://github.com/CollegesChat/university-information', text: 'CollegesChat' },
            ]}
          />
        </div>
        <div className="mt-3 px-1 text-[11px] sm:text-xs mono text-fog-500 leading-relaxed opacity-70">
          非商業公益 · CC BY-NC-SA 4.0 · 不提供志願填報建議
        </div>
      </footer>
    </main>
  )
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="border-b border-ink-800 p-4 flex flex-col gap-2 sm:border-b-0 sm:border-r sm:last:border-r-0">
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-fog-500">{label}</p>
      <p className="serif text-3xl text-fog-100">{value}</p>
      <p className="text-xs text-fog-500 leading-relaxed">{detail}</p>
    </div>
  )
}

function FooterGroup({
  label,
  items,
}: {
  label: string
  items: { href: string; text: string }[]
}) {
  return (
    <section className="border border-ink-800 sm:border-0 bg-ink-900/65 sm:bg-transparent px-4 py-3 sm:px-0 sm:py-0">
      <p className="mono text-[11px] uppercase tracking-[0.18em] text-fog-300">{label}</p>
      <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-x-3 sm:gap-y-1 text-xs mono text-fog-500 leading-relaxed">
        {items.map((item) => (
          <a
            key={item.href}
            className="hover:text-accent-500 break-all"
            href={item.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {item.text}
          </a>
        ))}
      </div>
    </section>
  )
}
