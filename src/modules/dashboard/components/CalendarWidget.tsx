import { useEffect, useState } from "react"
import { CalendarDays } from "lucide-react"
import { eventService, type CalendarEvent } from "@/services"
import DashboardListCard from "./DashboardListCard"

const today = new Date()
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
}

export default function CalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    eventService
      .getTodayEvents()
      .then((data) => {
        if (!cancelled) setEvents(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const dayOfWeek = dayNames[today.getDay()]
  const day = today.getDate()
  const month = monthNames[today.getMonth()]

  return (
    <DashboardListCard
      title="Calendar"
      loading={loading}
      emptyMessage={!loading && events.length === 0 ? "No events today" : undefined}
    >
      <div className="px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[10px] bg-primary-100 flex items-center justify-center">
            <CalendarDays size={18} className="text-primary-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-heading">{dayOfWeek}, {month} {day}</p>
            <p className="text-xs text-muted">{events.length} events today</p>
          </div>
        </div>
      </div>
      {events.slice(0, 5).map((ev) => (
        <div key={ev.name} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50 transition-colors">
          <span className="text-[11px] font-semibold text-muted w-16 shrink-0">
            {formatTime(ev.starts_on)}
          </span>
          <span className="text-xs font-medium text-body">{ev.subject}</span>
        </div>
      ))}
    </DashboardListCard>
  )
}
