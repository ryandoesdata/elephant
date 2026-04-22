import { useMutation, useQueryClient } from '@tanstack/react-query';
import { mergeSegments } from '../api/pieces';

export function useMergeSegments(pieceId) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leftSegmentId, rightSegmentId }) =>
      mergeSegments(pieceId, leftSegmentId, rightSegmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', pieceId] });
    },
  });
}
