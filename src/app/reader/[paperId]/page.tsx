'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import ExplanationPanel from '@/components/explanation-panel';

const PdfReader = dynamic(() => import('@/components/pdf-reader'), { ssr: false });
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ZoomIn, ZoomOut, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { CustomHighlight } from '@/components/pdf-reader';


interface PaperInfo {
  id: string;
  title: string;
  authors: string;
  journal: string;
  publishYear: number;
  impactFactor: number;
  jcrQuartile: string;
  citationCount: number;
  totalParagraphs: number;
  readProgress: number;
}

export default function ReaderPage() {
  const { paperId } = useParams<{ paperId: string }>();

  const [paper, setPaper] = useState<PaperInfo | null>(null);
  const [highlights, setHighlights] = useState<CustomHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedText, setSelectedText] = useState<string | null>(null);
  const [selectedParagraphId, setSelectedParagraphId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const [activeHighlight, setActiveHighlight] = useState<{
    highlight: CustomHighlight;
    position: { x: number; y: number };
  } | null>(null);

  // Load paper info
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/papers/${paperId}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        if (!cancelled) {
          setPaper(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('论文未找到');
          setLoading(false);
        }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [paperId]);

  // Load highlights
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/highlights?paperId=${paperId}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          // Filter out highlights with invalid positions (from old format)
          setHighlights(data.filter((h: any) =>
            h.position?.boundingRect?.pageNumber != null
          ));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [paperId]);

  // Add highlight
  const handleAddHighlight = useCallback(
    async (highlight: CustomHighlight) => {
      try {
        const res = await fetch('/api/highlights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paperId,
            position: highlight.position,
            content: highlight.content,
            color: highlight.color,
          }),
        });
        if (!res.ok) throw new Error('Failed');
        const saved = await res.json();
        setHighlights((prev) => [...prev, saved]);
        toast.success('已高亮');
      } catch {
        toast.error('保存高亮失败');
      }
    },
    [paperId]
  );

  // Update highlight (color / note)
  const handleUpdateHighlight = useCallback(
    async (id: string, updates: { color?: string; comment?: { text: string } }) => {
      try {
        const res = await fetch('/api/highlights', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...updates }),
        });
        if (!res.ok) throw new Error('Failed');
        const updated = await res.json();
        setHighlights((prev) => prev.map((h) => (h.id === id ? updated : h)));
        toast.success(updates.color ? '颜色已更新' : '笔记已保存');
      } catch {
        toast.error('更新失败');
      }
    },
    []
  );

  // Delete highlight
  const handleDeleteHighlight = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/highlights?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      setHighlights((prev) => prev.filter((h) => h.id !== id));
      toast.success('已删除高亮');
    } catch {
      toast.error('删除失败');
    }
  }, []);

  // Text selection → AI panel
  const handleTextSelect = useCallback((text: string) => {
    setSelectedText(text);
    setSelectedParagraphId(`sel-${Date.now()}`);
  }, []);

  // Apply scale to all PDF viewer elements
  const applyScale = useCallback((scale: number) => {
    const s = String(scale);
    const container = pdfContainerRef.current;
    if (!container) return;

    const targets = container.querySelectorAll('.pdfViewer, .PdfHighlighter, .PdfHighlighter > div, .page, [data-page-number]');
    targets.forEach((el) => {
      (el as HTMLElement).style.setProperty('--scale-factor', s);
    });

    // Also set on document root as fallback
    document.documentElement.style.setProperty('--scale-factor', s);

    // Apply transform to pages
    const pages = container.querySelectorAll('.page');
    pages.forEach((page: Element) => {
      (page as HTMLElement).style.transform = `scale(${scale})`;
      (page as HTMLElement).style.transformOrigin = 'center top';
    });
  }, []);

  // Sync --scale-factor whenever zoomLevel changes
  useEffect(() => {
    applyScale(zoomLevel / 100);
  }, [zoomLevel, applyScale]);

  // Zoom PDF
  const handleZoom = useCallback((direction: 'in' | 'out') => {
    const newScale = direction === 'in'
      ? Math.min(3, zoomLevel / 100 + 0.2)
      : Math.max(0.5, zoomLevel / 100 - 0.2);

    applyScale(newScale);
    setZoomLevel(Math.round(newScale * 100));
  }, [zoomLevel, applyScale]);

  // Pinch-to-zoom on PDF area only
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container) return;

    function handleWheel(e: WheelEvent) {
      if (e.ctrlKey) {
        e.preventDefault();

        const delta = e.deltaY > 0 ? -0.05 : 0.05;
        setZoomLevel(prev => {
          const newLevel = Math.max(50, Math.min(300, prev + delta * 100));
          return Math.round(newLevel);
        });
      }
    }

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Close highlight popup on outside click
  useEffect(() => {
    if (!activeHighlight) return;
    function handleClick() { setActiveHighlight(null); }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [activeHighlight]);

  if (loading) {
    return (
      <div className="flex h-screen">
        <div className="flex-1 p-8 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full mt-6" />
        </div>
        <div className="w-[380px] border-l border-border p-8">
          <Skeleton className="h-full w-full" />
        </div>
      </div>
    );
  }

  if (error || !paper) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">{error || '论文未找到'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: PDF reader */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden" ref={pdfContainerRef}>
        {/* Paper title bar */}
        <div className="shrink-0 px-4 py-2.5 border-b border-border bg-background">
          <h1 className="text-sm font-semibold leading-snug line-clamp-1">
            {paper.title}
          </h1>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
            {paper.authors && <span className="truncate">{paper.authors}</span>}
            {paper.publishYear > 0 && <span>{paper.publishYear}</span>}
            {paper.journal && (
              <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300">
                {paper.journal}
              </span>
            )}
            {paper.jcrQuartile && paper.jcrQuartile !== '未知' && (
              <span className={`px-1.5 py-0.5 rounded ${
                paper.jcrQuartile.startsWith('Q1')
                  ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-700 dark:text-teal-300'
                  : 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300'
              }`}>
                {paper.jcrQuartile}
              </span>
            )}
          </div>
        </div>

        {/* Zoom toolbar */}
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 border-b border-border bg-background">
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {paper.title}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleZoom('out')}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ZoomOut size={15} />
            </button>
            <span className="text-[11px] text-muted-foreground min-w-[36px] text-center">
              {zoomLevel}%
            </span>
            <button
              onClick={() => handleZoom('in')}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ZoomIn size={15} />
            </button>
          </div>
        </div>

        {/* PDF reader */}
        <div className="flex-1 overflow-hidden">
          <PdfReader
            pdfUrl={`/api/papers/${paperId}/pdf`}
            highlights={highlights}
            onAddHighlight={handleAddHighlight}
            onDeleteHighlight={handleDeleteHighlight}
            onUpdateHighlight={handleUpdateHighlight}
            onTextSelect={handleTextSelect}
            onHighlightClick={(highlight, e) => {
              setActiveHighlight({
                highlight,
                position: { x: e.clientX, y: e.clientY },
              });
            }}
          />

          {/* Highlight action popup */}
          {activeHighlight && (
            <div
              className="fixed z-[9999]"
              style={{
                left: activeHighlight.position.x,
                top: activeHighlight.position.y,
                transform: 'translate(-50%, -110%)',
              }}
            >
              <div
                className="bg-background border border-border rounded-lg shadow-lg p-2 flex items-center gap-1.5"
                onMouseDown={(e) => e.stopPropagation()}
              >
                {[
                  { key: 'blue', color: '#B5D4F4' },
                  { key: 'amber', color: '#FAE0A8' },
                  { key: 'teal', color: '#A8E6CF' },
                  { key: 'pink', color: '#F4B5CC' },
                ].map((c) => (
                  <button
                    key={c.key}
                    className="w-5 h-5 rounded-full hover:scale-125 transition-transform"
                    style={{
                      backgroundColor: c.color,
                      border: activeHighlight.highlight.color === c.key
                        ? '2px solid rgba(0,0,0,0.3)' : '2px solid transparent',
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      handleUpdateHighlight(activeHighlight.highlight.id, { color: c.key });
                      setActiveHighlight(null);
                    }}
                  />
                ))}

                <div className="w-px h-4 bg-border mx-0.5" />

                <button
                  className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-500 transition-colors"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleDeleteHighlight(activeHighlight.highlight.id);
                    setActiveHighlight(null);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: AI panel */}
      <div className="w-[380px] flex-shrink-0 border-l border-border bg-muted/20 flex flex-col overflow-hidden">
        <ExplanationPanel
          paperId={paperId}
          paragraphId={selectedParagraphId}
          paragraphContent={selectedText}
        />
      </div>
    </div>
  );
}
