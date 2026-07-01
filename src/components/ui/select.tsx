import { forwardRef, type SelectHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, id, children, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-heading">{label}</label>
        )}
        <select
          id={id}
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 bg-surface border rounded-xl text-sm text-body transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
            error ? "border-danger-500" : "border-border",
            className
          )}
          {...props}
        >
          {children}
        </select>
        {error && <p className="text-xs text-danger-500">{error}</p>}
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
