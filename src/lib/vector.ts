export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

export function findSimilarConcepts(
  targetEmbedding: number[],
  concepts: { id: string; name: string; embedding: number[] }[],
  topK: number = 5
): { id: string; name: string; similarity: number }[] {
  return concepts
    .map(c => ({
      id: c.id,
      name: c.name,
      similarity: cosineSimilarity(targetEmbedding, c.embedding),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
