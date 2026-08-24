import { useLayoutEffect, useRef, type ReactNode } from "react"

interface FitTextProps {
  children: ReactNode
  className?: string
  /** Font-size floor in px; below this the text falls back to truncation. */
  minSize?: number
}

// Renders its content at the natural size implied by `className`, then steps
// the font down until it fits on one line inside its parent column — large
// currency figures shrink instead of ellipsising in narrow summary cards.
export default function FitText({ children, className, minSize = 12 }: FitTextProps) {
  const ref = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    const parent = el?.parentElement
    if (!el || !parent) return
    // Capture the CSS-class-driven size once, before any inline override.
    const natural = parseFloat(getComputedStyle(el).fontSize) || 16

    const fit = () => {
      el.style.fontSize = `${natural}px`
      let size = natural
      while (size > minSize && el.scrollWidth > parent.clientWidth) {
        size -= 1
        el.style.fontSize = `${size}px`
      }
      // Floor reached and still overflowing -> ellipsis as last resort.
      el.classList.toggle("truncate", el.scrollWidth > parent.clientWidth)
    }

    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(parent)
    return () => {
      observer.disconnect()
      el.style.fontSize = ""
      el.classList.remove("truncate")
    }
  }, [children, minSize])

  return (
    <p ref={ref} className={`overflow-hidden whitespace-nowrap ${className ?? ""}`}>
      {children}
    </p>
  )
}
