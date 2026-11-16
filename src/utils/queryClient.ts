import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      // Fresh data is rendered directly when a view is revisited. Stale data is
      // revalidated in the background by React Query without replacing it with a
      // page-level loading state.
      refetchOnMount: true,
    },
  },
});
