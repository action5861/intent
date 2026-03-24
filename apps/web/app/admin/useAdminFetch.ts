"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function adminFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}
