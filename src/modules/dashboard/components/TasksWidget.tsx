import { useState, useEffect } from "react"
import { CheckCircle2, Circle } from "lucide-react"
import { cn } from "@/lib/utils"
import { todoService, type TodoItem } from "@/services"
import DashboardListCard from "./DashboardListCard"

export default function TasksWidget() {
  const [tasks, setTasks] = useState<TodoItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    todoService
      .getOpenTasks()
      .then((data) => {
        if (!cancelled) setTasks(data)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const toggle = (task: TodoItem) => {
    const newStatus = task.status === "Open" ? "Closed" : "Open"
    setTasks((prev) =>
      prev.map((t) => (t.name === task.name ? { ...t, status: newStatus as TodoItem["status"] } : t))
    )
    todoService.toggleStatus(task.name, task.status).catch(() => {
      setTasks((prev) =>
        prev.map((t) => (t.name === task.name ? { ...t, status: task.status } : t))
      )
    })
  }

  const visibleTasks = tasks.filter((t) => t.status === "Open").slice(0, 5)
  const doneCount = tasks.length - visibleTasks.length

  return (
    <DashboardListCard
      title="Tasks"
      headerRight={
        <span className="text-xs text-muted">
          {loading ? "—" : `${doneCount}/${tasks.length} done`}
        </span>
      }
      loading={loading}
      emptyMessage={!loading && tasks.length === 0 ? "No tasks" : undefined}
    >
      {tasks.map((task) => (
        <button
          key={task.name}
          onClick={() => toggle(task)}
          className="flex items-center gap-3 w-full px-5 py-2.5 hover:bg-gray-50 transition-colors text-left"
        >
          {task.status === "Closed" ? (
            <CheckCircle2 size={16} className="text-success-500 shrink-0" />
          ) : (
            <Circle size={16} className="text-muted shrink-0" />
          )}
          <span
            className={cn(
              "text-sm",
              task.status === "Closed" ? "text-muted line-through" : "text-body font-medium",
            )}
          >
            {task.description || task.name}
          </span>
        </button>
      ))}
    </DashboardListCard>
  )
}
