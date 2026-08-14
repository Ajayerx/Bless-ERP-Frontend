"use client"

import { useCallback, useMemo, useRef, useState, createContext, useContext, type ReactNode } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "./button"
import { messageTone, type AppMessage, type AppMessageTone } from "@/services/api-client"

interface MessageDialogContextValue {
  showMessage: (message: string | AppMessage) => void
}

const MessageDialogContext = createContext<MessageDialogContextValue | null>(null)

const toneDotClass: Record<AppMessageTone, string> = {
  error: "bg-danger-500",
  warning: "bg-warning-500",
  success: "bg-success-500",
  info: "bg-primary-500",
}

function normalize(message: string | AppMessage): AppMessage {
  const base =
    typeof message === "string"
      ? { message }
      : { title: message.title, message: message.message, indicator: message.indicator }
  // ERPNext msgprint defaults a missing indicator to blue (messages.js).
  return { ...base, indicator: base.indicator ?? "blue" }
}

// ERPNext-style "Message" modal (frappe.msgprint). One dialog shown at a time;
// additional messages are queued and revealed after the current one closes.
export function MessageDialogProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<AppMessage | null>(null)
  const queueRef = useRef<AppMessage[]>([])

  const showMessage = useCallback((message: string | AppMessage) => {
    const next = normalize(message)
    if (!next.message.trim()) return
    setCurrent((existing) => {
      if (existing) {
        queueRef.current = [...queueRef.current, next]
        return existing
      }
      return next
    })
  }, [])

  const dismiss = useCallback(() => {
    const next = queueRef.current.shift()
    setCurrent(next ?? null)
  }, [])

  const value = useMemo<MessageDialogContextValue>(
    () => ({ showMessage }),
    [showMessage]
  )

  return (
    <MessageDialogContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {current && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              onClick={dismiss}
              aria-hidden="true"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="relative w-full max-w-md bg-surface rounded-[16px] border border-border shadow-[0px_20px_60px_rgba(0,0,0,0.15)] overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "w-2.5 h-2.5 rounded-full shrink-0",
                      toneDotClass[messageTone(current.indicator)]
                    )}
                  />
                  <h2 className="text-base font-semibold text-heading">
                    {current.title || "Message"}
                  </h2>
                </div>
                <button
                  onClick={dismiss}
                  className="ml-4 p-1.5 rounded-[8px] text-muted hover:bg-gray-100 hover:text-body transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="px-6 py-5">
                <div
                  className="text-sm text-body leading-relaxed break-words whitespace-pre-line [&_strong]:font-semibold"
                  dangerouslySetInnerHTML={{ __html: current.message }}
                />
              </div>
              <div className="flex items-center justify-end px-6 py-4 border-t border-border bg-gray-50/50">
                <Button variant="secondary" size="sm" onClick={dismiss}>
                  OK
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </MessageDialogContext.Provider>
  )
}

export function useMessageDialog() {
  const ctx = useContext(MessageDialogContext)
  if (!ctx) throw new Error("useMessageDialog must be used within MessageDialogProvider")
  return ctx
}

export function messageFromError(err: unknown, fallback = "Something went wrong"): string | AppMessage {
  if (err && typeof err === "object" && "serverMessage" in err) {
    const sm = (err as { serverMessage: AppMessage | null }).serverMessage
    if (sm && sm.message) return sm
  }
  if (err instanceof Error && err.message) return { message: err.message }
  return { message: fallback }
}
