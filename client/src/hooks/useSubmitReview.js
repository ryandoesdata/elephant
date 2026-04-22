import { useMutation, useQueryClient } from '@tanstack/react-query';
import { submitReview } from '../api/pieces';

export function useSubmitReview(pieceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ cardId, rating }) => submitReview(pieceId, cardId, rating),
    onSuccess: () => {
      // Refresh both the session queue and the piece progress
      queryClient.invalidateQueries({ queryKey: ['session', pieceId] });
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
    },
  });
}
