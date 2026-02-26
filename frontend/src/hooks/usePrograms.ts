import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { programsApi } from '../services/api';

export const programKeys = {
  all: ['programs'] as const,
  lists: () => [...programKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...programKeys.lists(), params] as const,
  details: () => [...programKeys.all, 'detail'] as const,
  detail: (id: number) => [...programKeys.details(), id] as const,
};

export function usePrograms(params?: { status?: string; semester_id?: number }) {
  return useQuery({
    queryKey: programKeys.list(params || {}),
    queryFn: () => programsApi.list(params),
  });
}

export function useDeleteProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => programsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: programKeys.lists() });
    },
  });
}
