interface Props { onBack: () => void }

export function AboutPage({ onBack }: Props) {
  return (
    <main className="min-h-screen bg-ink-950 text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <button onClick={onBack} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500">
            ← 返回
          </button>
          <span className="mono text-xs text-fog-500">about</span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-6 pt-10 pb-24 flex flex-col gap-10 text-fog-300 leading-relaxed">
        <div>
          <h1 className="serif text-3xl text-fog-100 mb-4">為什麼做減法？</h1>
          <p>
            絕大多數志願填報工具都在告訴你「該考哪」。我們不做這件事。
            我們只陪你把不能忍的那一批劃掉，讓篩子從 3000+ 所變成剩下的幾百所。
          </p>
          <p className="mt-3">
            剩下的那些，不是「我們推薦你考」的，而是「你沒有理由排除它」的。
            判斷權始終在你手上。
          </p>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">三類維度</h2>
          <ul className="flex flex-col gap-3 list-disc pl-5">
            <li><b className="text-fog-100">A 紅線（5 題）</b>：省份、城市等級、辦學層次、學費、校區位置。一票否決，快速縮小。</li>
            <li><b className="text-fog-100">B 生活質量（24 題）</b>：宿舍、空調、澡堂、自習、晨跑、外賣、地鐵、斷電、熱水、門禁等。來自 CollegesChat 的 24 條標準問卷。</li>
            <li><b className="text-fog-100">C 特殊（5 題）</b>：飲食禁忌、無障礙、LGBTQ+、外省生源、學科評估。</li>
          </ul>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">數據來源</h2>
          <ul className="flex flex-col gap-2 text-sm">
            <li>· 教育部「雙一流」建設高校名單：<a className="text-accent-500 hover:text-accent-400 mono" href="https://www.moe.gov.cn/srcsite/A22/s7065/202202/t20220211_598710.html" target="_blank" rel="noreferrer noopener">moe.gov.cn ↗</a></li>
            <li>· 教育部「985 工程」名單：<a className="text-accent-500 hover:text-accent-400 mono" href="http://www.moe.gov.cn/srcsite/A22/moe_843/200611/t20061122_87771.html" target="_blank" rel="noreferrer noopener">moe.gov.cn ↗</a></li>
            <li>· 教育部第四輪學科評估（2017）：<a className="text-accent-500 hover:text-accent-400 mono" href="https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/" target="_blank" rel="noreferrer noopener">chinadegrees.cn ↗</a></li>
            <li>· 教育部陽光高考信息平台：<a className="text-accent-500 hover:text-accent-400 mono" href="https://gaokao.chsi.com.cn/" target="_blank" rel="noreferrer noopener">chsi.com.cn ↗</a></li>
            <li>· 第一財經新一線城市研究所：<a className="text-accent-500 hover:text-accent-400 mono" href="https://www.yicai.com/topic/100311963/" target="_blank" rel="noreferrer noopener">yicai.com ↗</a></li>
            <li>· CollegesChat 眾包問卷（CC BY-NC-SA 4.0）：<a className="text-accent-500 hover:text-accent-400 mono" href="https://github.com/CollegesChat/university-information" target="_blank" rel="noreferrer noopener">github.com/CollegesChat ↗</a></li>
            <li>· xioajiumi/Chinese_Universities（MIT）：<a className="text-accent-500 hover:text-accent-400 mono" href="https://github.com/xioajiumi/Chinese_Universities" target="_blank" rel="noreferrer noopener">github.com/xioajiumi ↗</a></li>
            <li>· jorhelp/EDU_Website（GPL-3.0）：<a className="text-accent-500 hover:text-accent-400 mono" href="https://github.com/jorhelp/EDU_Website" target="_blank" rel="noreferrer noopener">github.com/jorhelp ↗</a></li>
          </ul>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">方法論</h2>
          <ul className="flex flex-col gap-2 text-sm list-disc pl-5">
            <li><b className="text-fog-100">疑罪從無</b>：當某所學校某維度數據缺失，不會用該題排除它。</li>
            <li><b className="text-fog-100">中性展示</b>：不對任何學校做「絕對不推薦」標籤；所有維度以事實 + 時間戳 + 來源呈現。</li>
            <li><b className="text-fog-100">非商業</b>：本站非商業用途；派生自 CollegesChat 的生活質量數據繼承 CC BY-NC-SA 4.0。</li>
            <li><b className="text-fog-100">允許申訴下架</b>：學校官方可通過 <a className="text-accent-500" href="mailto:nope@bdfz.net">nope@bdfz.net</a> 申訴，48 小時內處理。</li>
            <li><b className="text-fog-100">不提供志願填報建議</b>：本站不是教育機構，不對錄取結果負責。</li>
          </ul>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">和姊妹站的關係</h2>
          <ul className="flex flex-col gap-2 text-sm list-disc pl-5">
            <li><a className="text-accent-500 hover:text-accent-400" href="https://path.bdfz.net" target="_blank" rel="noreferrer noopener">path.bdfz.net</a> — 職業減法（先確定你要做什麼）</li>
            <li><a className="text-accent-500 hover:text-accent-400" href="https://nope.bdfz.net" target="_blank" rel="noreferrer noopener">nope.bdfz.net</a> — 學校減法（再確定你不去哪）</li>
            <li><a className="text-accent-500 hover:text-accent-400" href="https://750.bdfz.net" target="_blank" rel="noreferrer noopener">750.bdfz.net</a> — 北京高考語料庫</li>
            <li><a className="text-accent-500 hover:text-accent-400" href="https://my.bdfz.net" target="_blank" rel="noreferrer noopener">my.bdfz.net</a> — 登錄後，減法結果自動同步</li>
          </ul>
        </div>
      </section>
    </main>
  )
}
