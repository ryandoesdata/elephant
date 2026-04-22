import { useQuery } from '@tanstack/react-query';
import { fetchSession } from '../api/pieces';

export function useSession(pieceId, movementId = null) {
  return useQuery({
    queryKey: ['session', pieceId, movementId],
    queryFn: () => fetchSession(pieceId, movementId),
    enabled: !!pieceId,
    staleTime: 0,
  });
}
