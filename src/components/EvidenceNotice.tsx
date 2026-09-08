import { DIMENSIONS } from '../data/dimensions'

export function EvidenceNotice() {
  return (
    <aside className="rounded-lg border border-amber-500/20 bg-ink-900 px-4 py-3 text-xs text-fog-300 leading-relaxed">
      <p className="text-fog-100 font-medium">匿名生活回報暫不參與整校排除</p>
      <p className="mt-1">宿舍、地鐵、門禁等會因校區與年份而異。沒有整校依據的生活題暫緩出題，已有的相關選擇也不會據此劃掉學校。這會保留部分原本符合你排除條件的學校；結果不表示它們滿足所有生活偏好。</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-accent-500">查看生活資料範圍與暫緩原因</summary>
        <p className="mt-2">{Object.values(DIMENSIONS).filter(d => d.id.startsWith('B')).map(d => d.label).join('、')}。</p>
        <p className="mt-1">未核實整校範圍與當年度狀態的回報只供參考；你仍可在學校詳情查看分歧、未知數量與官方補充。</p>
      </details>
    </aside>
  )
}
