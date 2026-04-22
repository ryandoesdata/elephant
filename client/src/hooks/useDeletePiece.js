import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deletePiece } from '../api/pieces';

export function useDeletePiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (pieceId) => deletePiece(pieceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces'] });
    },
  });
}
