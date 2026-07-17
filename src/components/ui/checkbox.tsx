import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const Checkbox = React.forwardRef<
  React.ComponentRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    label?: string
    error?: string
  }
>(({ className, label, error, id, ...props }, ref) => {
  const checkboxId = id ?? React.useId()

  const checkbox = (
    <CheckboxPrimitive.Root
      ref={ref}
      id={checkboxId}
      className={cn(
        "peer h-5 w-5 shrink-0 rounded-md border border-border bg-surface transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=checked]:bg-primary-600 data-[state=checked]:border-primary-600 data-[state=checked]:text-white",
        error && "border-danger-500 focus:ring-danger-500/20 focus:border-danger-500",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check size={14} strokeWidth={3} />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  if (!label) {
    return (
      <div>
        {checkbox}
        {error && <p className="text-xs text-danger-500 mt-1">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2.5">
        {checkbox}
        <label
          htmlFor={checkboxId}
          className="text-sm font-medium text-heading leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </label>
      </div>
      {error && <p className="text-xs text-danger-500">{error}</p>}
    </div>
  )
})
Checkbox.displayName = "Checkbox"

export { Checkbox }
