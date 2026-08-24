import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

interface Props {
  title: string
  headerRight?: ReactNode
  loading?: boolean
  emptyMessage?: string
  children: ReactNode
  className?: string
  scrollable?: boolean
}

export default function DashboardListCard({
  title,
  headerRight,
  loading,
  emptyMessage,
  children,
  className,
  scrollable,
}: Props) {
  return (
    <Card
      className={cn(
        "min-h-[380px] flex flex-col",
        scrollable && "overflow-hidden",
        className,
      )}
    >
      <CardHeader className="px-5 py-3">
        <CardTitle>{title}</CardTitle>
        {headerRight}
      </CardHeader>
      <CardContent className={cn("p-0 flex-1 flex flex-col", scrollable && "min-h-0")}>
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 size={18} className="animate-spin text-muted" />
          </div>
        ) : emptyMessage ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-sm text-muted text-center">{emptyMessage}</p>
          </div>
        ) : (
          <div
            className={
              scrollable
                ? "divide-y divide-border flex-1 min-h-0 overflow-y-auto"
                : "divide-y divide-border"
            }
          >
            {children}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
