"use client"

import { useState, useEffect } from "react"

import {
  Search,
  Bell,
  HelpCircle,
  Sun,
  Moon,
  Monitor,
  Globe,
  LogOut,
  User,
  ChevronDown,
  Building2,
} from "lucide-react"
import NotificationDropdown from "@/modules/notifications/components/NotificationDropdown"
import CompanySwitcher from "./CompanySwitcher"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui"
import { Avatar } from "@/components/ui/avatar"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { useTheme } from "@/context/ThemeContext"
import GlobalSearch from "./GlobalSearch"

export default function Topbar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <header className="h-16 bg-surface border-b border-border flex items-center justify-between px-6 sticky top-0 z-20">
      {/* Search */}
      <div className="relative max-w-md w-full">
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-[12px] text-sm text-muted transition-all duration-200 hover:bg-gray-100 hover:border-border text-left"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <span>Search anything...</span>
          <kbd className="ml-auto hidden sm:inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-200 text-muted">
            Ctrl+K
          </kbd>
        </button>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Company Switcher */}
        <CompanySwitcher />

        {/* Help */}
        <button className="p-2.5 rounded-[10px] text-muted hover:text-body hover:bg-gray-100 transition-colors">
          <HelpCircle size={18} />
        </button>

        {/* Notifications */}
        <NotificationDropdown />

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
            <DropdownMenuItem onClick={() => navigate("/settings?tab=profile")}>
              <User size={16} />
              My Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings?tab=general")}>
              <Building2 size={16} />
              Company Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/notifications")}>
              <Bell size={16} />
              Notifications
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/settings?tab=appearance")}>
              <Globe size={16} />
              Language
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === "system" ? <Monitor size={16} /> : theme === "light" ? <Moon size={16} /> : <Sun size={16} />}
              {theme === "system" ? "System Theme" : theme === "light" ? "Dark Mode" : "Light Mode"}
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
