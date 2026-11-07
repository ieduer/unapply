import type { ReactNode } from 'react'

/**
 * 富文本模板：翻譯字串裡允許少量標記，讓粗體、數字、鏈接的位置可以隨語言移動——
 *   <b>…</b> 強調（text-fog-100）、<n>…</n> 等寬數字、<x>…</x> 強調色數字、<code>…</code>、<br/>、
 *   <a1>…</a1>…<a9>…</a9> 由呼叫端的 slots 包成按鈕或鏈接（鏈接文字留在模板裡，網址留在程式裡）。
 * 標記不可嵌套；{name} 佔位符由 params 代入（可以是 ReactNode）。test:i18n 檢查三語的標記與佔位符集合一致。
 */
export type RichParams = Record<string, ReactNode>
export type RichSlots = Record<string, (children: ReactNode) => ReactNode>

const TOKEN = /(<br\/>|<(a\d|b|n|x|code)>([\s\S]*?)<\/\2>|\{(\w+)\})/g

function interpolateNodes(text: string, params: RichParams | undefined, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let i = 0
  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    const index = match.index ?? 0
    if (index > last) out.push(text.slice(last, index))
    const name = match[1]
    out.push(params && name in params ? <span key={`${keyPrefix}-p${i}`}>{params[name]}</span> : match[0])
    last = index + match[0].length
    i += 1
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function renderRich(template: string, params?: RichParams, slots?: RichSlots): ReactNode[] {
  const nodes: ReactNode[] = []
  let last = 0
  let i = 0
  for (const match of template.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > last) nodes.push(...interpolateNodes(template.slice(last, index), params, `t${i}`))
    const [whole, , tag, inner, param] = match
    const key = `r${i}`
    if (whole === '<br/>') nodes.push(<br key={key} />)
    else if (param !== undefined) nodes.push(params && param in params ? <span key={key}>{params[param]}</span> : whole)
    else {
      const children = interpolateNodes(inner ?? '', params, key)
      if (tag === 'b') nodes.push(<b key={key} className="text-fog-100">{children}</b>)
      else if (tag === 'n') nodes.push(<span key={key} className="mono text-fog-100">{children}</span>)
      else if (tag === 'x') nodes.push(<span key={key} className="mono text-accent-500">{children}</span>)
      else if (tag === 'code') nodes.push(<code key={key} className="mono text-fog-300">{children}</code>)
      else if (tag && slots?.[tag]) nodes.push(<span key={key} className="contents">{slots[tag](children)}</span>)
      else nodes.push(<span key={key}>{children}</span>)
    }
    last = index + whole.length
    i += 1
  }
  if (last < template.length) nodes.push(...interpolateNodes(template.slice(last), params, 'tail'))
  return nodes
}

