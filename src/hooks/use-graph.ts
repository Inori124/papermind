'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GraphData } from '@/types';

export function useGraph(paperId?: string) {
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const url = paperId ? `/api/graph?paperId=${paperId}` : '/api/graph';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch graph');
      const graphData = await res.json();
      setData(graphData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  return { data, loading, error, refetch: fetchGraph };
}
