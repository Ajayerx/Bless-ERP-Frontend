import type { ReactNode } from "react"
import { Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

interface Props {
  title: string
  headerRight?: ReactNode
  loading?: boolean
  emptyMessage?: string
  children: ReactNode
  className?: string
}

export default function DashboardListCard({
  title,
  headerRight,
  loading,
  emptyMessage,
  children,
  className,
}: Props) {
  return (
    <Card className={`min-h-[380px] flex flex-col ${className ?? ""}`}>
      <CardHeader className="px-5 py-3">
        <CardTitle>{title}</CardTitle>
        {headerRight}
      </CardHeader>
      <CardContent className="p-0 flex-1 flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 size={18} className="animate-spin text-muted" />
          </div>
        ) : emptyMessage ? (
          <div className="flex items-center justify-center flex-1">
            <p className="text-sm text-muted text-center">{emptyMessage}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">{children}</div>
        )}
      </CardContent>
    </Card>
  )
}
