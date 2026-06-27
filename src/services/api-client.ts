const API_BASE = "/api"

export class ApiError extends Error {
  status: number

  constructor(
    status: number,
    message: string
  ) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("blesserp_token") : null

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })

  const body = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, body.error?.message ?? "Something went wrong")
  }

  return body.data as T
}
