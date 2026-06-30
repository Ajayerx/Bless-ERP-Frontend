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

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Search */}
      <div className="relative max-w-md w-full">
        <Search
          size={16}
          className={cn(
            "absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200",
            searchFocused ? "text-primary-500" : "text-muted"
          )}
        />
        <input
          type="text"
          placeholder="Search anything..."
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          className={cn(
            "w-full pl-10 pr-4 py-2.5 bg-gray-50 border rounded-[12px] text-sm text-body placeholder:text-muted transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary-500/20",
            searchFocused
              ? "border-primary-500 bg-white shadow-sm"
              : "border-transparent hover:bg-gray-100"
          )}
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Help */}
        <button className="p-2.5 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
          <HelpCircle size={18} />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors"
        >
          {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Language */}
        <button className="p-2.5 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
          <Globe size={18} />
        </button>

        {/* Notifications */}
        <button className="p-2.5 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors relative">
          <Bell size={18} />
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute top-2 right-2 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white"
          />
        </button>

        <div className="h-6 w-px bg-border mx-2" />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2.5 pl-1 pr-2 py-1.5 rounded-[10px] hover:bg-gray-100 transition-colors">
              <Avatar name={user?.name ?? "User"} size="sm" />
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-heading leading-tight">
                  {user?.name}
                </p>
                <p className="text-xs text-muted">{user?.email}</p>
              </div>
              <ChevronDown size={14} className="text-muted hidden sm:block" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{user?.name}</DropdownMenuLabel>
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
