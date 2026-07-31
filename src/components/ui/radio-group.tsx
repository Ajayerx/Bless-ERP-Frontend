import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { Circle } from "lucide-react"
import { cn } from "@/lib/utils"

const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & {
    label?: string
    error?: string
  }
>(({ className, label, error, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && (
      <p className="text-sm font-normal text-heading">{label}</p>
    )}
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2.5", className)}
      {...props}
      ref={ref}
    />
    {error && <p className="text-xs text-danger-500">{error}</p>}
  </div>
))
RadioGroup.displayName = "RadioGroup"

const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "aspect-square h-5 w-5 rounded-full border border-border bg-surface transition-all duration-200",
      "focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-primary-600 data-[state=checked]:border-[5px]",
      className
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
      <Circle className="h-2 w-2 fill-primary-600 text-primary-600" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
))
RadioGroupItem.displayName = "RadioGroupItem"

export { RadioGroup, RadioGroupItem }
