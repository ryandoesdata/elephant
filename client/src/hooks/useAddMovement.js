import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createMovement } from '../api/pieces';

export function useAddMovement(pieceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, orderIndex }) => createMovement(pieceId, title, orderIndex),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', String(pieceId)] });
    },
  });
}
