import { apiClient, ApiError, parseErrorMessage } from "./api-client"
import { API_CONFIG } from "../config/api.config"

export interface User {
  id: string
  name: string
  email?: string
  avatar?: string
}

export interface AuthService {
  login(usr: string, pwd: string): Promise<{ full_name?: string; home_page?: string }>
  logout(): Promise<void>
  getCurrentUser(): Promise<User | null>
}

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : undefined
}

export const authService: AuthService = {
  async login(usr: string, pwd: string) {
    const res = await fetch(`${API_CONFIG.baseUrl}/method/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usr, pwd }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new ApiError(res.status, parseErrorMessage(body, "Login failed"))
    }
    return { full_name: body.full_name, home_page: body.home_page }
  },

  async logout(): Promise<void> {
    try {
      await apiClient("/method/logout", { method: "POST" })
    } catch {
      // ignore server errors — clear local state regardless
    }
  },

  async getCurrentUser(): Promise<User | null> {
    const userId = getCookie("user_id")
    if (!userId || userId === "Guest") return null
    try {
      const doc = await apiClient<any>(`/resource/User/${encodeURIComponent(userId)}`)
      return {
        id: userId,
        name: doc.full_name || doc.first_name || userId,
        email: doc.email,
        avatar: doc.user_image,
      }
    } catch {
      return null // session is truly invalid
    }
  },
}