"use client"

import { forwardRef, type FocusEvent, type MouseEvent } from "react"
import { Input, type InputProps } from "./input"

// Instantly opens the native date-picker when the field is clicked/focused
// (Chrome/Edge). Falls back to the browser's calendar icon on engines
// without showPicker (Safari), and is a safe no-op for readonly/disabled
// or non-visible inputs (showPicker throws in those cases).
export function openNativeDatePicker(el: HTMLInputElement | null) {
  if (!el || typeof el.showPicker !== "function") return
  try {
    el.showPicker()
  } catch {
    // already showing / not user-triggerable — keep native behavior
  }
}

const DateInput = forwardRef<HTMLInputElement, InputProps>(
  (
    { onClick, onFocus, type: _type, ...props },
    ref,
  ) => {
    const handleClick = (e: MouseEvent<HTMLInputElement>) => {
      openNativeDatePicker(e.currentTarget)
      onClick?.(e)
    }
    const handleFocus = (e: FocusEvent<HTMLInputElement>) => {
      openNativeDatePicker(e.currentTarget)
      onFocus?.(e)
    }
    return <Input ref={ref} type="date" onClick={handleClick} onFocus={handleFocus} {...props} />
  },
)
DateInput.displayName = "DateInput"

export { DateInput }