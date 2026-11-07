import { tpl } from './core'
import { renderRich, type RichParams, type RichSlots } from './richRender'

export type { RichParams, RichSlots }

/** 以鍵取模板並渲染；元件在頂層呼叫過 useLocale() 時，語言切換會重繪這裡。標記與佔位符規則見 richRender.tsx。 */
export function Rich({ k, params, slots }: { k: string; params?: RichParams; slots?: RichSlots }) {
  return <>{renderRich(tpl(k), params, slots)}</>
}
