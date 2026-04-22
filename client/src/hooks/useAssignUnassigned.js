import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assignUnassignedPhrases } from '../api/pieces';

export function useAssignUnassigned(pieceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (movementId) => assignUnassignedPhrases(pieceId, movementId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
    },
  });
}
