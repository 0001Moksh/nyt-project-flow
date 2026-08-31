import { useState, useEffect, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Custom Stale-While-Revalidate (SWR) cache hook.
 * Instantly serves cached data upon navigation/remount while performing background revalidation.
 */
export function useDataCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: { ttl?: number; enabled?: boolean }
) {
  const ttl = options?.ttl ?? DEFAULT_TTL;
  const enabled = options?.enabled ?? true;

  const cached = memoryCache.get(key);
  const [data, setData] = useState<T | null>(cached ? cached.data : null);
  const [isLoading, setIsLoading] = useState<boolean>(!cached && enabled);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const executeFetch = useCallback(
    async (isBackground = false) => {
      if (!enabled) return;
      if (isBackground) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      try {
        const freshData = await fetcherRef.current();
        memoryCache.set(key, { data: freshData, timestamp: Date.now() });
        setData(freshData);
      } catch (err: any) {
        setError(err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [key, enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    const existing = memoryCache.get(key);
    const isStale = !existing || Date.now() - existing.timestamp > ttl;

    if (existing) {
      setData(existing.data);
      setIsLoading(false);
      if (isStale) {
        executeFetch(true);
      }
    } else {
      executeFetch(false);
    }
  }, [key, enabled, ttl, executeFetch]);

  const mutate = useCallback(
    async (newData?: T | ((prev: T | null) => T)) => {
      if (typeof newData !== 'undefined') {
        const updated = typeof newData === 'function' ? (newData as any)(data) : newData;
        memoryCache.set(key, { data: updated, timestamp: Date.now() });
        setData(updated);
      }
      return executeFetch(true);
    },
    [key, data, executeFetch]
  );

  const invalidate = useCallback(() => {
    memoryCache.delete(key);
    return executeFetch(false);
  }, [key, executeFetch]);

  return {
    data,
    isLoading,
    isRefreshing,
    error,
    refetch: () => executeFetch(true),
    mutate,
    invalidate,
  };
}

export function clearGlobalCache() {
  memoryCache.clear();
}
