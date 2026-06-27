import { apiClient } from "./api-client"

export interface LoginRequest {
  email: string
  password: string
}

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
}

export interface AuthResponse {
  user: User
  token: string
}

export interface AuthService {
  login(data: LoginRequest): Promise<AuthResponse>
  logout(): Promise<void>
}

export const authService: AuthService = {
  async login(data) {
    return apiClient<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },

  async logout() {
    return apiClient<void>("/auth/logout", { method: "POST" })
  },
}
