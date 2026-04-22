import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createPiece } from '../api/pieces';

export function useAddPiece() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title, composer, totalMeasures }) =>
      createPiece(title, composer, totalMeasures),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pieces'] });
    },
  });
}
