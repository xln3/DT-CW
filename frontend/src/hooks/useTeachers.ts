import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachersApi } from '../services/api';

export const teacherKeys = {
  all: ['teachers'] as const,
  lists: () => [...teacherKeys.all, 'list'] as const,
  list: (params: Record<string, unknown>) => [...teacherKeys.lists(), params] as const,
  details: () => [...teacherKeys.all, 'detail'] as const,
  detail: (id: number) => [...teacherKeys.details(), id] as const,
};

export function useTeachers(params: { status?: string; search?: string }) {
  return useQuery({
    queryKey: teacherKeys.list(params),
    queryFn: () => teachersApi.list(params),
  });
}

export function useDeleteTeacher() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => teachersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teacherKeys.lists() });
    },
  });
}
