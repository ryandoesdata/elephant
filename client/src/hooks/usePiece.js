import { useQuery } from '@tanstack/react-query';
import { fetchPiece } from '../api/pieces';

export function usePiece(pieceId) {
  return useQuery({
    queryKey: ['piece', pieceId],
    queryFn: () => fetchPiece(pieceId),
    enabled: !!pieceId,
  });
}
