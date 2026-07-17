import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"

const STORAGE_KEY = "blesserp_installed_apps"

interface AppContextType {
  installedAppIds: string[]
  installApp: (id: string) => void
  uninstallApp: (id: string) => void
  isInstalled: (id: string) => boolean
}

const AppContext = createContext<AppContextType | null>(null)

function loadInstalled(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [installedAppIds, setInstalledAppIds] = useState<string[]>(loadInstalled)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(installedAppIds))
  }, [installedAppIds])

  const installApp = useCallback((id: string) => {
    setInstalledAppIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const uninstallApp = useCallback((id: string) => {
    setInstalledAppIds((prev) => prev.filter((appId) => appId !== id))
  }, [])

  const isInstalled = useCallback(
    (id: string) => installedAppIds.includes(id),
    [installedAppIds]
  )

  return (
    <AppContext.Provider value={{ installedAppIds, installApp, uninstallApp, isInstalled }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useAppContext must be used within AppProvider")
  return ctx
}
