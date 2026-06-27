"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import {
  Search,
  Bell,
  HelpCircle,
  Sun,
  Moon,
  Globe,
  LogOut,
  Settings,
  User,
  ChevronDown,
  Command,
} from "lucide-react"
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
import { cn } from "@/lib/utils"

export default function Topbar() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  return (
    <header className="h-16 bg-surface/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Search */}
      <div className="relative max-w-md w-full">
        <Search
          size={16}
          className={cn(
            "absolute left-3.5 top-1/2 -translate-y-1/2 transition-all duration-200",
            searchFocused ? "text-primary-500" : "text-muted"
          )}
        />
        <input
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search anything..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className={cn(
            "w-full pl-10 pr-12 py-2.5 rounded-[12px] text-sm text-body placeholder:text-muted transition-all duration-200",
            "focus:outline-none focus:ring-2",
            searchFocused
              ? "bg-white border border-primary-500 shadow-sm shadow-primary-500/5 focus:ring-primary-500/20"
              : "bg-gray-50 border border-transparent hover:bg-gray-100 focus:ring-primary-500/10"
          )}
        />
        {!searchFocused && !searchValue && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
            <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-muted/60 bg-gray-100 rounded-md">
              <Command size={10} />K
            </kbd>
          </div>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-0.5">
        <IconButton icon={<HelpCircle size={18} />} label="Help" />
        <IconButton
          icon={theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
          label="Toggle theme"
          onClick={toggleTheme}
        />
        <IconButton icon={<Globe size={18} />} label="Language" />

        {/* Notifications */}
        <button className="relative p-2.5 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-all duration-200 active:scale-95">
          <Bell size={18} />
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white"
          />
        </button>

        <div className="h-6 w-px bg-border mx-1.5" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-[10px] hover:bg-gray-100 transition-all duration-200 active:scale-[0.98]">
              <Avatar name={user?.name ?? "User"} size="sm" />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-heading leading-tight">
                  {user?.name}
                </p>
                <p className="text-xs text-muted leading-tight">{user?.email}</p>
              </div>
              <motion.div
                animate={{ rotate: 0 }}
                whileHover={{ rotate: 180 }}
                transition={{ duration: 0.3 }}
              >
                <ChevronDown size={14} className="text-muted hidden sm:block" />
              </motion.div>
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
      </div>
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
      className="p-2.5 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-all duration-200 active:scale-95"
    >
      {icon}
    </button>
  )
}
