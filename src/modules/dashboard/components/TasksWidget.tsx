import { useState } from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui"
import { cn } from "@/lib/utils"

const initialTasks = [
  { id: "t1", label: "Review pending invoices", done: false },
  { id: "t2", label: "Approve purchase order #PO-023", done: false },
  { id: "t3", label: "Update inventory counts", done: true },
  { id: "t4", label: "Follow up with Maple Store", done: false },
]

export default function TasksWidget() {
  const [tasks, setTasks] = useState(initialTasks)

  const toggle = (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    )
  }

  const doneCount = tasks.filter((t) => t.done).length

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <span className="text-xs text-muted">{doneCount}/{tasks.length} done</span>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border">
          {tasks.map((task) => (
            <button
              key={task.id}
              onClick={() => toggle(task.id)}
              className="flex items-center gap-3 w-full px-6 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              {task.done ? (
                <CheckCircle2 size={16} className="text-success-500 shrink-0" />
              ) : (
                <Circle size={16} className="text-muted shrink-0" />
              )}
              <span
                className={cn(
                  "text-sm",
                  task.done ? "text-muted line-through" : "text-body font-medium",
                )}
              >
                {task.label}
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
