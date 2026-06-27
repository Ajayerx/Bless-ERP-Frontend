import { cn } from "@/lib/utils"

interface AvatarProps {
  name: string
  size?: "sm" | "md" | "lg"
  className?: string
  src?: string
}

const sizeMap = {
  sm: "w-7 h-7 text-xs",
  md: "w-9 h-9 text-sm",
  lg: "w-12 h-12 text-base",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

const bgColors = [
  "bg-primary-100 text-primary-700",
  "bg-purple-100 text-purple-700",
  "bg-success-100 text-success-700",
  "bg-warning-100 text-warning-700",
  "bg-info-100 text-info-700",
  "bg-danger-100 text-danger-700",
]

function getColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return bgColors[Math.abs(hash) % bgColors.length]
}

export function Avatar({ name, size = "md", className, src }: AvatarProps) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={cn("rounded-full object-cover", sizeMap[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center font-semibold shrink-0",
        sizeMap[size],
        getColor(name),
        className
      )}
    >
      {getInitials(name)}
    </div>
  )
}
