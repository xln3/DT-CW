import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { membersApi } from '../services/api';

export const memberKeys = {
  all: ['members'] as const,
  lists: () => [...memberKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...memberKeys.lists(), params] as const,
  details: () => [...memberKeys.all, 'detail'] as const,
  detail: (id: number) => [...memberKeys.details(), id] as const,
};

export function useMembers(params: { status?: string; search?: string; sort?: string; graduating?: string; page: number; per_page?: number }) {
  return useQuery({
    queryKey: memberKeys.list(params),
    queryFn: () => membersApi.listPaginated(params),
  });
}

export function useMember(id: number) {
  return useQuery({
    queryKey: memberKeys.detail(id),
    queryFn: () => membersApi.get(id),
    enabled: !!id,
  });
}

export function useDeleteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => membersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.lists() });
    },
  });
}
