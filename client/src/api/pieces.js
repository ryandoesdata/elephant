import api from './client';

export async function fetchPieces() {
  const { data } = await api.get('/pieces');
  return data;
}

export async function fetchPiece(pieceId) {
  const { data } = await api.get(`/pieces/${pieceId}`);
  return data;
}

export async function createPiece(title, composer, totalMeasures) {
  const { data } = await api.post('/pieces', { title, composer, totalMeasures });
  return data;
}

export async function createMovement(pieceId, title, orderIndex) {
  const { data } = await api.post(`/pieces/${pieceId}/movements`, { title, orderIndex });
  return data;
}

// addPhrase for a movement; pass movementId=null for piece-level phrases
export async function addPhrase(pieceId, movementId, measureStart, measureEnd) {
  const url = movementId != null
    ? `/pieces/${pieceId}/movements/${movementId}/phrases`
    : `/pieces/${pieceId}/phrases`;
  const { data } = await api.post(url, { measureStart, measureEnd });
  return data;
}

export async function fetchSession(pieceId, movementId = null, limit = 10) {
  const params = { limit };
  if (movementId != null) params.movementId = movementId;
  const { data } = await api.get(`/pieces/${pieceId}/session`, { params });
  return data;
}

export async function submitReview(pieceId, cardId, rating) {
  const { data } = await api.post(`/pieces/${pieceId}/reviews`, { cardId, rating });
  return data;
}

export async function fetchSegments(pieceId) {
  const { data } = await api.get(`/pieces/${pieceId}/segments`);
  return data;
}

export async function assignUnassignedPhrases(pieceId, movementId) {
  const { data } = await api.patch(`/pieces/${pieceId}/movements/${movementId}/claim-phrases`);
  return data;
}

export async function deletePiece(pieceId) {
  await api.delete(`/pieces/${pieceId}`);
}

export async function deleteMovement(pieceId, movementId) {
  await api.delete(`/pieces/${pieceId}/movements/${movementId}`);
}

export async function fetchStats(pieceId) {
  const { data } = await api.get(`/pieces/${pieceId}/stats`);
  return data;
}

export async function breakSegment(pieceId, segmentId, midPoint) {
  const { data } = await api.post(`/pieces/${pieceId}/segments/${segmentId}/break`, { midPoint });
  return data;
}

export async function mergeSegments(pieceId, leftSegmentId, rightSegmentId) {
  const { data } = await api.post(`/pieces/${pieceId}/segments/merge`, { leftSegmentId, rightSegmentId });
  return data;
}
