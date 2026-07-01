import { forwardRef, type InputHTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={id}
            className="block text-sm font-medium text-heading"
          >
            {label}
          </label>
        )}
        <input
          id={id}
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 bg-surface border rounded-xl text-sm text-body placeholder:text-muted transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
            error ? "border-danger-500 focus:ring-danger-500/20 focus:border-danger-500" : "border-border",
            className
          )}
          {...props}
        />
        {error && <p className="text-xs text-danger-500">{error}</p>}
        {helperText && !error && (
          <p className="text-xs text-muted">{helperText}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
