import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { rehearsalsApi } from '../services/api';

export const rehearsalKeys = {
  all: ['rehearsals'] as const,
  lists: () => [...rehearsalKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...rehearsalKeys.lists(), params] as const,
  details: () => [...rehearsalKeys.all, 'detail'] as const,
  detail: (id: number) => [...rehearsalKeys.details(), id] as const,
};

export function useRehearsals(params?: { program_id?: number; date_from?: string; date_to?: string }) {
  return useQuery({
    queryKey: rehearsalKeys.list(params || {}),
    queryFn: () => rehearsalsApi.list(params),
  });
}

export function useDeleteRehearsal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => rehearsalsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rehearsalKeys.lists() });
    },
  });
}
