'use client';

import { useState, useCallback, useEffect } from 'react';
import type { Paper, Paragraph, Annotation } from '@/types';

export function usePapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPapers = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/papers', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPapers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  const deletePaper = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/papers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setPapers((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      throw err;
    }
  }, []);

  const updatePaper = useCallback(async (id: string, data: Record<string, unknown>) => {
    const res = await fetch(`/api/papers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update');
    }
    const updated = await res.json();
    setPapers((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  return { papers, loading, error, refetch: fetchPapers, deletePaper, updatePaper };
}

export function usePaper(paperId: string) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [paragraphs, setParagraphs] = useState<Paragraph[]>([]);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [paperRes, parasRes, annosRes] = await Promise.all([
        fetch(`/api/papers/${paperId}`),
        fetch(`/api/papers/${paperId}/paragraphs`),
        fetch(`/api/annotate?paperId=${paperId}`),
      ]);

      if (!paperRes.ok) throw new Error('Paper not found');

      setPaper(await paperRes.json());
      setParagraphs(await parasRes.json());
      setAnnotations(await annosRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [paperId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createAnnotation = useCallback(
    async (data: { paragraphId: string; paperId: string; content: string; type: string }) => {
      const res = await fetch('/api/annotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create annotation');
      const anno = await res.json();
      setAnnotations((prev) => [anno, ...prev]);
      return anno;
    },
    []
  );

  const updateAnnotation = useCallback(async (id: string, content: string) => {
    const res = await fetch('/api/annotate', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, content }),
    });
    if (!res.ok) throw new Error('Failed to update annotation');
    const updated = await res.json();
    setAnnotations((prev) => prev.map((a) => (a.id === id ? updated : a)));
  }, []);

  return {
    paper,
    paragraphs,
    annotations,
    loading,
    error,
    refetch: fetchAll,
    createAnnotation,
    updateAnnotation,
  };
}
