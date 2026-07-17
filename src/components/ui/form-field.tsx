import * as React from "react"
import { cn } from "@/lib/utils"

interface FormFieldProps {
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  htmlFor?: string
  className?: string
  children: React.ReactNode
}

function FormField({ label, error, helperText, required, htmlFor, className, children }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-heading"
        >
          {label}
          {required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-danger-500">{error}</p>}
      {helperText && !error && (
        <p className="text-xs text-muted">{helperText}</p>
      )}
    </div>
  )
}

export { FormField }
export type { FormFieldProps }
