import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './api';

// Thin wrapper that adapts our axios instance to TanStack Query.
// Usage:
//   const { data, isLoading, error } = useApiQuery({
//     queryKey: ['members', filters],
//     queryFn: ({ signal }) => adminAPI.getMembers(filters, { signal }).then(r => r.data)
//   });
//
// The AbortSignal is honoured by axios, so navigating away mid-flight
// actually cancels the request.

export function useApiQuery({ queryKey, queryFn, ...rest }) {
  return useQuery({
    queryKey,
    queryFn: ({ signal }) => queryFn({ signal }),
    ...rest
  });
}

export function useApiMutation({ mutationFn, invalidateKeys, onSuccess, ...rest } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars) => mutationFn(vars),
    onSuccess: (data, vars, ctx) => {
      if (invalidateKeys) {
        for (const key of invalidateKeys) {
          qc.invalidateQueries({ queryKey: key });
        }
      }
      if (onSuccess) onSuccess(data, vars, ctx);
    },
    ...rest
  });
}

export default useApiQuery;
