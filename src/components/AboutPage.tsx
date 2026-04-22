import {
  adultHigherEducationCount,
  officialSchoolCount,
  officialUndergraduateCount,
  officialVocationalCount,
} from '../data/schoolCatalogSummary'

interface Props { onBack: () => void }

export function AboutPage({ onBack }: Props) {
  return (
    <main className="min-h-screen app-canvas text-fog-100">
      <header className="sticky top-0 z-10 backdrop-blur bg-ink-950/80 border-b border-ink-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <button onClick={onBack} className="text-xs mono uppercase tracking-[0.2em] text-fog-500 hover:text-accent-500 min-h-[44px] -my-3 py-3">
            ← 返回
          </button>
          <span className="mono text-xs text-fog-500">about</span>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 pb-24 flex flex-col gap-8 sm:gap-10 text-fog-300 leading-relaxed text-sm sm:text-base">
        <div>
          <h1 className="serif text-3xl text-fog-100 mb-4">為什麼做減法？</h1>
          <p>
            絕大多數志願填報工具都在告訴你「該考哪」。我們不做這件事。
            我們只陪你把不能忍的那一批劃掉，讓篩子從教育部 2025 名單的 {officialSchoolCount.toLocaleString()} 所普通高校變成剩下的幾百所。
          </p>
          <p className="mt-3">
            剩下的那些，不是「我們推薦你考」的，而是「你沒有理由排除它」的。
            判斷權始終在你手上。
          </p>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">四類維度（基礎 42 維）</h2>
          <p className="text-sm text-fog-500 mb-4">
            問卷會按當前數據覆蓋動態出題。沒有任何實際刪減能力的題或限制選項，會先暫時隱藏，避免你白答一輪。
          </p>
          <ul className="flex flex-col gap-3 list-disc pl-5">
            <li><b className="text-fog-100">A 紅線（5 題）</b>：省份、城市等級、辦學層次、學費口徑、校區位置。一票否決；校區和精確學費未知時保持未知。</li>
            <li><b className="text-fog-100">E 環境（8 題）</b>：集中供暖、夏冬體感、霧霾、方言、地鐵、沿海、高海拔。從省份+城市由氣象局／生態環境部／軌道交通協會數據<span className="text-fog-100">客觀推導</span>，覆蓋所有學校。</li>
            <li><b className="text-fog-100">B 生活質量（24 題）</b>：宿舍、空調、澡堂、自習、晨跑、外賣、斷電、熱水、門禁等。眾包維度，缺失就缺失，不默認。</li>
            <li><b className="text-fog-100">C 特殊（5 題）</b>：飲食禁忌、無障礙、LGBTQ+、外省生源、學科評估。</li>
          </ul>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">數據來源</h2>
          <h3 className="serif text-lg text-fog-100 mt-3 mb-2">官方／權威（年度基準）</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <li>· 教育部 2025 全國普通高等學校名單：{officialSchoolCount.toLocaleString()} 所（本科 {officialUndergraduateCount.toLocaleString()} · 高職專科 {officialVocationalCount.toLocaleString()}；成人高校 {adultHigherEducationCount.toLocaleString()} 所只作口徑說明） <a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/202506/t20250627_1195683.html" target="_blank" rel="noreferrer noopener">moe.gov.cn ↗</a></li>
            <li>· 教育部「雙一流」建設高校名單：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.moe.gov.cn/srcsite/A22/s7065/202202/t20220211_598710.html" target="_blank" rel="noreferrer noopener">moe.gov.cn ↗</a></li>
            <li>· 教育部「985 工程」名單：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.moe.gov.cn/srcsite/A22/s7065/200612/t20061206_128833.html" target="_blank" rel="noreferrer noopener">moe.gov.cn ↗</a></li>
            <li>· 教育部第四輪學科評估（2017）：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.chinadegrees.cn/xwyyjsjyxx/xkpgjg/" target="_blank" rel="noreferrer noopener">chinadegrees.cn ↗</a></li>
            <li>· 陽光高考信息平台（學費／分省計劃）：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://gaokao.chsi.com.cn/" target="_blank" rel="noreferrer noopener">chsi.com.cn ↗</a></li>
            <li>· 中國氣象局（氣候分區）：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.cma.gov.cn/2011xzt/essay/" target="_blank" rel="noreferrer noopener">cma.gov.cn ↗</a></li>
            <li>· 生態環境部（PM2.5 年均）：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.mee.gov.cn/hjzl/sthjzk/zghjzkgb/" target="_blank" rel="noreferrer noopener">mee.gov.cn ↗</a></li>
            <li>· 中國城市軌道交通協會：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.camet.org.cn/tjxx/" target="_blank" rel="noreferrer noopener">camet.org.cn ↗</a></li>
            <li>· 第一財經新一線城市研究所：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.yicai.com/topic/100311963/" target="_blank" rel="noreferrer noopener">yicai.com ↗</a></li>
            <li>· 民政部《全國行政區劃》：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.mca.gov.cn/" target="_blank" rel="noreferrer noopener">mca.gov.cn ↗</a></li>
            <li>· 《中國語言地圖集》（商務印書館／中國社科院）：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://www.cssn.cn/" target="_blank" rel="noreferrer noopener">cssn.cn ↗</a></li>
          </ul>
          <h3 className="serif text-lg text-fog-100 mt-4 mb-2">眾包（部分覆蓋，缺失不默認）</h3>
          <ul className="flex flex-col gap-2 text-sm">
            <li>· CollegesChat 眾包問卷（CC BY-NC-SA 4.0）：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://github.com/CollegesChat/university-information" target="_blank" rel="noreferrer noopener">github.com/CollegesChat ↗</a></li>
            <li>· 用戶貢獻（經 GitHub Issue 三人審核後入庫）：<a className="text-accent-500 hover:text-accent-400 mono break-all" href="https://github.com/ieduer/unapply/issues?q=label%3Adata-contribution" target="_blank" rel="noreferrer noopener">ieduer/unapply issues ↗</a></li>
          </ul>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">口徑與缺失處理</h2>
          <ul className="flex flex-col gap-2 text-sm list-disc pl-5">
            <li>教育部 2025 版口徑下，普通高校 {officialSchoolCount.toLocaleString()} 所；成人高校 {adultHigherEducationCount.toLocaleString()} 所只作口徑說明，不進篩選主池。</li>
            <li>人工增強字段目前覆蓋少量重點學校，用來補英文名、校區類型和少量高價值樣本；不是官方主表。</li>
            <li>數據缺失的維度，本站採用 <b className="text-fog-100">疑罪從無</b>：不排除該校，也不猜測填空。</li>
            <li>暫時沒有實際刪減能力的題和限制選項，會先隱藏；等數據補齊後再放回問卷。具體口徑和缺口說明統一放在這裡，不打斷做題。</li>
          </ul>
        </div>

        <div>
          <h2 className="serif text-2xl text-fog-100 mb-4">方法論</h2>
          <ul className="flex flex-col gap-2 text-sm list-disc pl-5">
            <li><b className="text-fog-100">疑罪從無</b>：當某所學校某維度數據缺失，不會用該題排除它。</li>
            <li><b className="text-fog-100">不默認</b>：不以「985 通常有這樣」之類推論來填充學校級別的具體字段。缺失就缺失，引導用戶貢獻。</li>
            <li><b className="text-fog-100">權威層級推導是例外</b>：省份 → 氣候／方言／沿海這種地理事實來自權威機構，不是默認。</li>
            <li><b className="text-fog-100">中性展示</b>：所有維度以事實 + 時間戳 + 來源呈現。</li>
            <li><b className="text-fog-100">非商業</b>：本站非商業公益；派生自 CollegesChat 的數據繼承 CC BY-NC-SA 4.0。</li>
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

        <div className="border border-ink-800 bg-ink-900/60 rounded-xl px-4 py-4">
          <h2 className="serif text-xl text-fog-100 mb-3">如果你覺得它有用</h2>
          <p className="text-sm text-fog-400 leading-relaxed">
            歡迎把網站發給熟悉不同學校的學長學姐、在讀同學和校友。每多一條可核驗的補充，問卷就會少一點空白，也更接近真正能幫人做減法的工具。
          </p>
        </div>
      </section>
    </main>
  )
}
