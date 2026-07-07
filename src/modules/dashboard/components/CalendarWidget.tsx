import { CalendarDays } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"

const today = new Date()
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const events = [
  { time: "10:00 AM", label: "Team standup" },
  { time: "2:00 PM", label: "Supplier call - Fresh Choice" },
  { time: "4:30 PM", label: "Inventory review" },
]

export default function CalendarWidget() {
  const dayOfWeek = dayNames[today.getDay()]
  const day = today.getDate()
  const month = monthNames[today.getMonth()]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calendar</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-11 h-11 rounded-[10px] bg-primary-100 flex items-center justify-center">
            <CalendarDays size={20} className="text-primary-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-heading">{dayOfWeek}, {month} {day}</p>
            <p className="text-xs text-muted">{events.length} events today</p>
          </div>
        </div>
        <div className="space-y-2">
          {events.map((ev) => (
            <div key={ev.time} className="flex items-center gap-3 px-3 py-2 rounded-[8px] bg-gray-50">
              <span className="text-[11px] font-semibold text-muted w-16 shrink-0">{ev.time}</span>
              <span className="text-xs font-medium text-body">{ev.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
