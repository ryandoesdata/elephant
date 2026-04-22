import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addPhrase } from '../api/pieces';

export function useAddPhrase(pieceId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ movementId, measureStart, measureEnd }) =>
      addPhrase(pieceId, movementId, measureStart, measureEnd),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', String(pieceId)] });
      queryClient.invalidateQueries({ queryKey: ['pieces'] });
    },
  });
}
