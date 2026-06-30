import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { authService, type User } from "../services"

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("auth_user")
    return stored ? JSON.parse(stored) : null
  })

  useEffect(() => {
    const token = localStorage.getItem("auth_token")
    if (!token) setUser(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedInUser, token } = await authService.login({ email, password })
    localStorage.setItem("auth_token", token)
    localStorage.setItem("auth_user", JSON.stringify(loggedInUser))
    setUser(loggedInUser)
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
