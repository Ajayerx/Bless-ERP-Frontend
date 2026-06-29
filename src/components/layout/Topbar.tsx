"use client"

import { Bell, HelpCircle, Sun, Moon, LogOut, Settings, User, ChevronDown } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui"
import { Avatar } from "@/components/ui/avatar"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
export default function Topbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()

  return (
    <header className="h-14 bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-end px-6 gap-1 sticky top-0 z-20">
      <IconButton icon={<HelpCircle size={18} />} label="Help" />
      <IconButton
        icon={theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
        label="Toggle theme"
        onClick={toggleTheme}
      />
      <IconButton icon={<Bell size={18} />} label="Notifications" />

      <div className="h-5 w-px bg-border mx-1" />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-lg hover:bg-muted/50 transition-colors active:scale-[0.98]">
            <Avatar name={user?.name ?? "User"} size="sm" />
            <span className="hidden sm:block text-sm font-medium text-body">{user?.name}</span>
            <ChevronDown size={14} className="text-muted hidden sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex items-center gap-3">
              <Avatar name={user?.name ?? "User"} size="sm" />
              <div>
                <p className="text-sm font-semibold text-heading">{user?.name}</p>
                <p className="text-xs text-muted">{user?.email}</p>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User size={16} />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings size={16} />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={logout}
            className="text-danger-500 data-[highlighted]:text-danger-600 data-[highlighted]:bg-danger-50"
          >
            <LogOut size={16} />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}

function IconButton({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="p-2 rounded-lg text-muted hover:text-body hover:bg-muted/50 transition-colors"
    >
      {icon}
    </button>
  )
}
