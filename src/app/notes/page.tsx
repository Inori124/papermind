'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  StickyNote, ChevronDown, ChevronRight, Sparkles, Loader2,
  Highlighter, MessageSquare, ExternalLink,
} from 'lucide-react';

interface PaperOverview {
  id: string;
  title: string;
  authors: string;
  totalParagraphs: number;
  readParagraphs: number;
  readProgress: number;
  annotationCount: number;
  highlightCount: number;
  reviewNote: string;
  paragraphNotes: ParagraphNote[];
}

interface ParagraphNote {
  paragraphId: string;
  paragraphPreview: string;
  section: string;
  annotations: AnnotationItem[];
  highlights: HighlightItem[];
}

interface AnnotationItem {
  id: string;
  content: string;
  type: string;
  aiExplanation: string;
  createdAt: string;
}

interface HighlightItem {
  id: string;
  text: string;
  note: string;
  color: string;
}

export default function NotesPage() {
  const [papers, setPapers] = useState<PaperOverview[]>([]);
  const [expandedPaper, setExpandedPaper] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/notes/overview')
      .then((res) => res.json())
      .then((data) => { setPapers(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleGenerateSummary(paperId: string) {
    setGeneratingId(paperId);
    try {
      const res = await fetch('/api/notes/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paperId }),
      });
      const data = await res.json();
      if (data.summary) {
        setPapers((prev) =>
          prev.map((p) =>
            p.id === paperId ? { ...p, reviewNote: data.summary } : p
          )
        );
      }
    } catch {
      /* ignore */
    } finally {
      setGeneratingId(null);
    }
  }

  const totalNotes = papers.reduce(
    (sum, p) => sum + p.annotationCount + p.highlightCount,
    0,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-muted-foreground" size={24} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] overflow-y-auto px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-lg font-semibold">我的笔记</h1>
        <p className="text-xs text-muted-foreground mt-1">
          共 {papers.length} 篇论文 · {totalNotes} 条笔记与标注
        </p>
      </div>

      {/* Empty state */}
      {papers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <StickyNote size={48} strokeWidth={1} className="mb-3 opacity-30" />
          <p className="text-sm">还没有任何笔记</p>
          <p className="text-xs mt-1">
            在精读论文时添加笔记和高亮，它们会自动出现在这里
          </p>
        </div>
      )}

      {/* Paper note cards */}
      <div className="space-y-3">
        {papers.map((paper) => {
          const isExpanded = expandedPaper === paper.id;
          const isGenerating = generatingId === paper.id;
          const hasNotes = paper.annotationCount > 0 || paper.highlightCount > 0;

          return (
            <div key={paper.id} className="border border-border rounded-lg overflow-hidden">
              {/* Card header — always visible */}
              <div
                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => setExpandedPaper(isExpanded ? null : paper.id)}
              >
                <div className="mt-0.5 text-muted-foreground">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium leading-snug line-clamp-2">
                    {paper.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">{paper.authors}</p>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${paper.readProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      已读 {paper.readProgress}%
                    </span>
                  </div>

                  {/* Stats badges */}
                  <div className="flex items-center gap-2 mt-2">
                    {paper.annotationCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600">
                        <MessageSquare size={10} /> {paper.annotationCount} 笔记
                      </span>
                    )}
                    {paper.highlightCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/30 text-amber-600">
                        <Highlighter size={10} /> {paper.highlightCount} 高亮
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground transition-all duration-150 hover:border-foreground/20 hover:text-foreground hover:shadow-[0_1px_2px_rgba(0,0,0,0.04)] active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateSummary(paper.id);
                    }}
                    disabled={isGenerating || !hasNotes}
                  >
                    {isGenerating ? (
                      <><Loader2 size={12} className="animate-spin" /> 生成中...</>
                    ) : (
                      <><Sparkles size={12} /> 生成复习笔记</>
                    )}
                  </button>
                  <button
                    className="text-xs p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/reader/${paper.id}`);
                    }}
                    title="进入精读"
                  >
                    <ExternalLink size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded content — grid animation */}
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
              >
                <div className="overflow-hidden">
                  <div className="border-t border-border px-4 py-4 bg-muted/[0.03]">
                  {/* AI review note */}
                  {paper.reviewNote && (
                    <div className="mb-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg p-4">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Sparkles size={13} className="text-blue-600" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
                          AI 复习笔记
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
                        {paper.reviewNote}
                      </p>
                    </div>
                  )}

                  {/* Per-paragraph notes timeline */}
                  {paper.paragraphNotes.length > 0 ? (
                    <div className="space-y-3">
                      {paper.paragraphNotes.map((pn, index) => (
                        <div
                          key={pn.paragraphId}
                          className="relative pl-4 border-l-2 border-border"
                        >
                          <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-blue-400" />

                          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                            {pn.section || `段落 ${index + 1}`}
                          </span>

                          <p
                            className="text-xs text-muted-foreground mt-1 italic cursor-pointer hover:text-foreground transition-colors"
                            onClick={() => router.push(`/reader/${paper.id}`)}
                          >
                            &ldquo;{pn.paragraphPreview}&rdquo;
                          </p>

                          {pn.annotations.map((ann) => (
                            <div
                              key={ann.id}
                              className="mt-2 bg-background border border-border rounded-md p-2.5"
                            >
                              <div className="flex items-center gap-1 mb-1">
                                <MessageSquare size={10} className="text-blue-500" />
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(ann.createdAt).toLocaleDateString('zh-CN', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed">{ann.content}</p>
                            </div>
                          ))}

                          {pn.highlights
                            .filter((h) => h.note)
                            .map((h) => (
                              <div
                                key={h.id}
                                className="mt-2 bg-amber-50/50 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900 rounded-md p-2.5"
                              >
                                <div className="flex items-center gap-1 mb-1">
                                  <Highlighter size={10} className="text-amber-500" />
                                  <span className="text-[10px] text-muted-foreground">
                                    高亮: &ldquo;{h.text.slice(0, 30)}...&rdquo;
                                  </span>
                                </div>
                                <p className="text-sm leading-relaxed">{h.note}</p>
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      这篇论文还没有逐段笔记
                    </p>
                  )}
                </div>
              </div>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
