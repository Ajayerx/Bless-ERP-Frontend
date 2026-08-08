import { useLayoutEffect, useRef } from "react"

export function useAutoGrowTextarea<T extends HTMLTextAreaElement = HTMLTextAreaElement>() {
  const ref = useRef<T>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  })

  return ref
}
