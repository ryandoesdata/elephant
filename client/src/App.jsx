import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PieceListScreen from './screens/PieceListScreen';
import PieceDetailScreen from './screens/PieceDetailScreen';
import StudySessionScreen from './screens/StudySessionScreen';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PieceListScreen />} />
          <Route path="/pieces/:pieceId" element={<PieceDetailScreen />} />
          {/* Piece-level study (no movements) */}
          <Route path="/pieces/:pieceId/study" element={<StudySessionScreen />} />
          {/* Movement-level study */}
          <Route
            path="/pieces/:pieceId/movements/:movementId/study"
            element={<StudySessionScreen />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
