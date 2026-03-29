const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api/v1";

interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  page?: number;
  limit?: number;
  total_rows?: number;
  total_pages?: number;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("jk_token");
}

export function setToken(token: string) {
  localStorage.setItem("jk_token", token);
}

export function removeToken() {
  localStorage.removeItem("jk_token");
}

export function hasToken(): boolean {
  return !!getToken();
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Don't set Content-Type for FormData (browser will set it with boundary)
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      removeToken();
      if (typeof window !== "undefined") {
        window.location.href = "/auth";
      }
    }
    throw new Error(data.message || "Request failed");
  }

  return data;
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint),

  post: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),

  put: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  patch: <T>(endpoint: string, body?: unknown) =>
    request<T>(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),

  delete: <T>(endpoint: string) =>
    request<T>(endpoint, { method: "DELETE" }),

  upload: <T>(endpoint: string, formData: FormData) =>
    request<T>(endpoint, {
      method: "POST",
      body: formData,
    }),
};
