import { useMutation, useQueryClient } from '@tanstack/react-query';
import { breakSegment } from '../api/pieces';

export function useBreakSegment(pieceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ segmentId, midPoint }) => breakSegment(pieceId, segmentId, midPoint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
    },
  });
}
