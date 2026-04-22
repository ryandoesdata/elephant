import { useQuery } from '@tanstack/react-query';
import { fetchPieces } from '../api/pieces';

export function usePieces() {
  return useQuery({
    queryKey: ['pieces'],
    queryFn: fetchPieces,
  });
}
