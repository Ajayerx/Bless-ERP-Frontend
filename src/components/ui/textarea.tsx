import { forwardRef, type TextareaHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-heading">{label}</label>
        )}
        <textarea
          id={id}
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 bg-surface border rounded-xl text-sm text-body placeholder:text-muted transition-all duration-200 min-h-[80px]",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
            error ? "border-danger-500" : "border-border",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger-500">{error}</p>}
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
