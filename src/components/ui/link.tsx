import React from "react"
import { Link as RouterLink, type LinkProps } from "react-router-dom"
import { cn } from "@/lib/utils"

const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <RouterLink
        ref={ref}
        className={cn(
          "inline-flex items-center gap-2 text-sm text-muted hover:text-body transition-colors",
          className
        )}
        {...props}
      >
        {children}
      </RouterLink>
    )
  }
)
Link.displayName = "Link"

export { Link }
