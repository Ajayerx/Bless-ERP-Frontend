import { useMemo } from "react"
import { useAppContext } from "@/context/AppContext"
import { AVAILABLE_MODULES, type Module } from "@/config/modules.config"

export function useInstalledApps() {
  const { installedAppIds, installApp, uninstallApp, isInstalled } = useAppContext()

  const installed = useMemo(
    () => AVAILABLE_MODULES.filter((m) => installedAppIds.includes(m.id)),
    [installedAppIds]
  )

  const available = useMemo(
    () => AVAILABLE_MODULES.filter((m) => !installedAppIds.includes(m.id)),
    [installedAppIds]
  )

  const getModule = (id: string): Module | undefined =>
    AVAILABLE_MODULES.find((m) => m.id === id)

  return { installed, available, installApp, uninstallApp, isInstalled, getModule }
}
