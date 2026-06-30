const API_BASE = "/api"
export class ApiError extends Error {
  public status: number;  // ← declare here

  constructor(status: number, message: string) {
    super(message);
    this.status = status;  // ← assign here
    this.name = "ApiError";
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    },
  })

  const body = await res.json()

  if (!res.ok) {
    throw new ApiError(res.status, body.error?.message ?? "Something went wrong")
  }

  return body.data as T
}
