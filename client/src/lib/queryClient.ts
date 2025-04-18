import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get Firebase token if available
  const authToken = localStorage.getItem("authToken");
  
  // Prepare headers
  const headers: Record<string, string> = {};
  
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  
  // Add Firebase ID token if available
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include", // Keep cookies for session fallback
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Get Firebase token if available
    const authToken = localStorage.getItem("authToken");
    
    // Prepare headers
    const headers: Record<string, string> = {};
    
    // Add Firebase ID token if available
    if (authToken) {
      headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    const res = await fetch(queryKey[0] as string, {
      headers,
      credentials: "include", // Keep cookies for session fallback
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 30000, // Keep data fresh for 30 seconds
      gcTime: 5 * 60 * 1000, // Cache for 5 minutes (TanStack Query v5 uses gcTime instead of cacheTime)
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
