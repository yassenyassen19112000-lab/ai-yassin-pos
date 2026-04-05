import { customFetch } from "@workspace/api-client-react";

export async function apiClient<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  return customFetch<T>(url, options);
}
