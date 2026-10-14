import { useQuery } from "@tanstack/react-query";
import { apiGet, ApiError } from "./api";
import type { User } from "./types";

export function useMe() {
  return useQuery<User | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await apiGet<User>("/auth/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export function startGoogleLogin() {
  const redirectUrl = window.location.origin + "/dashboard";
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
}

export function errorMessage(e: unknown, fallback = "Something went wrong"): string {
  if (e instanceof ApiError) {
    const body = e.body as { detail?: unknown } | null;
    if (body && typeof body.detail === "string") return body.detail;
  }
  return fallback;
}
