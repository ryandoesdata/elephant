import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteMovement } from '../api/pieces';

export function useDeleteMovement(pieceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movementId) => deleteMovement(pieceId, movementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', String(pieceId)] });
    },
  });
}
