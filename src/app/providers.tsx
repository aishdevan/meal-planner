"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cross-phone "sync": refetch on focus + gentle polling while
            // a shared screen is open. Good enough for a family of two.
            refetchOnWindowFocus: true,
            refetchInterval: 15_000,
            staleTime: 5_000,
            retry: 1,
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
