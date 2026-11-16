// import { useQuery, useMutation, useQueryClient, } from '@tanstack/react-query';
// import { api } from '../services/api';

import type { QueryKey } from '@tanstack/react-query';
// keep any real runtime imports separate, e.g.:
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

export interface QueryCacheOptions<T> {
  queryKey: QueryKey;
  fetcher: () => Promise<T>;
  staleTime?: number;
  gcTime?: number;
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useQueryCache<T>({
  queryKey,
  fetcher,
  staleTime = 5 * 60 * 1000,
  gcTime = 30 * 60 * 1000,
  enabled = true,
  refetchInterval = false,
}: QueryCacheOptions<T>) {
  return useQuery({
    queryKey,
    queryFn: fetcher,
    staleTime,
    gcTime,
    enabled,
    refetchInterval,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
    retry: 1,
  });
}

export function useQueryMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    invalidateKeys?: QueryKey[];
  }
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      if (options?.invalidateKeys) {
        options.invalidateKeys.forEach((key) => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }
      options?.onSuccess?.(data, variables);
    },
    onError: options?.onError,
  });
}

export function useInvalidateQueries(queryKey: QueryKey) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey });
}

export function usePrefetchQuery<T>(queryKey: QueryKey, fetcher: () => Promise<T>, staleTime = 5 * 60 * 1000) {
  const queryClient = useQueryClient();
  return () => queryClient.prefetchQuery({ queryKey, queryFn: fetcher, staleTime });
}

export const queryKeys = {
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  students: ['students'] as const,
  student: (id: string) => ['students', id] as const,
  supervisors: ['supervisors'] as const,
  supervisor: (id: string) => ['supervisors', id] as const,
  forms: ['forms'] as const,
  form: (id: string) => ['forms', id] as const,
  templates: (formId: string) => ['templates', formId] as const,
  teams: ['teams'] as const,
  team: (id: string) => ['teams', id] as const,
  meetings: (formId: string) => ['meetings', formId] as const,
  submissions: (stage: string, documentId: string) => ['submissions', stage, documentId] as const,
  dashboard: (role: string) => ['dashboard', role] as const,
  notifications: (userId: string) => ['notifications', userId] as const,
  meetingReport: (formId: string) => ['meetingReport', formId] as const,
};
