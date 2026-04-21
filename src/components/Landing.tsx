import { schoolCount, totalKnownSchoolCount } from '../data/schools'

interface Props {
  onStart: () => void
  onAbout: () => void
}

export function Landing({ onStart, onAbout }: Props) {
  return (
    <main className="min-h-screen bg-ink-950 text-fog-100 flex flex-col items-center justify-between px-6 py-12">
      <div className="w-full max-w-2xl flex items-center justify-between text-xs mono uppercase tracking-[0.25em] text-fog-500">
        <span>nope.bdfz.net · v1.0</span>
        <button
          onClick={onAbout}
          className="hover:text-accent-500 transition-colors"
        >
          about
        </button>
      </div>

      <section className="w-full max-w-2xl flex flex-col gap-12">
        <h1 className="serif text-4xl sm:text-6xl leading-tight">
          <span className="block text-fog-500 text-xl sm:text-2xl tracking-wider mb-6">減法人生 · 學校版</span>
          你一定<span className="text-accent-500">不考</span>
          <br />哪所大學
        </h1>

        <p className="text-base sm:text-lg text-fog-300 leading-relaxed max-w-xl">
          這裡不告訴你「該考哪所」。<br />
          只陪你從已知的 <span className="mono text-fog-100">{totalKnownSchoolCount.toLocaleString()}</span> 所
          中，用你自己的不能忍，劃掉一批。
        </p>

        <div className="flex flex-col gap-3">
          <p className="text-sm text-fog-500 mono">
            本次種子池 / {schoolCount} 所主流院校（C9 · 985 · 211 · 雙一流）
          </p>
          <p className="text-sm text-fog-500">
            其餘 {(totalKnownSchoolCount - schoolCount).toLocaleString()} 所於 v1.1
            引入。數據不足的維度，疑罪從無，不會誤殺學校。
          </p>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={onStart}
            className="px-7 py-3 bg-accent-500 text-ink-950 rounded-full font-semibold text-base hover:bg-accent-400 transition-colors"
          >
            開始減法 →
          </button>
          <span className="text-xs mono text-fog-500">29 題 · 可隨時跳過</span>
        </div>
      </section>

      <footer className="w-full max-w-2xl text-xs mono text-fog-500 leading-relaxed space-y-1">
        <div>姊妹站：
          <a className="hover:text-accent-500" href="https://path.bdfz.net">path · 職業減法</a> · {' '}
          <a className="hover:text-accent-500" href="https://750.bdfz.net">750 · 北京高考</a> · {' '}
          <a className="hover:text-accent-500" href="https://my.bdfz.net">my · 用戶中心</a>
        </div>
        <div className="opacity-70">非商業用途 · CC BY-NC-SA 4.0 · 不提供志願填報建議</div>
      </footer>
    </main>
  )
}
