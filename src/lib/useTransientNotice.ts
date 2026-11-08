import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 短暫提示（2026-11-08 批 G6c）：show() 讓提示出現 ms 毫秒後自動消失；再按一次會重新計時。
 * 搭配一個常駐的 aria-live 區塊使用（區塊本身一直在 DOM 裡，只換文字），讀屏才會讀出。
 */
export function useTransientNotice(ms = 2600): [boolean, () => void] {
  const [visible, setVisible] = useState(false)
  const timer = useRef<number | null>(null)
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current) }, [])
  const show = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    setVisible(true)
    timer.current = window.setTimeout(() => { setVisible(false); timer.current = null }, ms)
  }, [ms])
  return [visible, show]
}
