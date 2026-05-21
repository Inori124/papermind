'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, ChevronRight, Lightbulb, Microscope, Search } from 'lucide-react';

interface AnalysisData {
  overview: string;
  commonalities: {
    themes: string[];
    methods: string[];
    gaps: string[];
  };
  paperSummaries: {
    paperId: string;
    title: string;
    summary: string;
    contribution: string;
  }[];
  clusters: {
    label: string;
    paperIds: string[];
    description: string;
  }[];
}

const CLUSTER_COLORS = [
  'border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/10',
  'border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/10',
  'border-l-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/10',
  'border-l-violet-400 bg-violet-50/50 dark:bg-violet-950/10',
  'border-l-rose-400 bg-rose-50/50 dark:bg-rose-950/10',
];

interface Props {
  folderId: string;
}

export default function FolderAnalysis({ folderId }: Props) {
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/folders/${folderId}/analysis`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setAnalysis(data.analysis);
      setUpdatedAt(data.updatedAt);
    } catch {
      // no cached analysis yet
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleGenerate = useCallback(async () => {
    try {
      setGenerating(true);
      setError(null);
      const res = await fetch(`/api/folders/${folderId}/analysis`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || '分析失败');
      }
      const data = await res.json();
      setAnalysis(data.analysis);
      setUpdatedAt(data.updatedAt);
    } catch (e: any) {
      setError(e.message || 'AI 分析失败');
    } finally {
      setGenerating(false);
    }
  }, [folderId]);

  // Loading skeleton
  if (loading) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-muted-foreground" />
            <Skeleton className="h-5 w-32" />
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Empty state — no cached analysis
  if (!analysis) {
    return (
      <Card className="mb-6">
        <CardContent className="py-6">
          <div className="flex flex-col items-center text-center gap-3">
            <Sparkles size={24} className="text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">AI 文献综合解读</p>
              <p className="text-xs text-muted-foreground mt-1">
                对该文件夹内的所有论文进行综合分析，识别研究主题、常用方法、论文聚类等
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="gap-1.5"
            >
              {generating ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  分析中...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  开始分析
                </>
              )}
            </Button>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Rendering analysis
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-blue-500" />
            <CardTitle className="text-sm">AI 文献综合解读</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {updatedAt && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(updatedAt).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6"
              onClick={handleGenerate}
              disabled={generating}
              title="重新分析"
            >
              <RefreshCw size={12} className={generating ? 'animate-spin' : ''} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Section 1: Overview */}
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Lightbulb size={13} className="text-amber-500" />
            <h4 className="text-xs font-medium">研究概览</h4>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{analysis.overview}</p>
        </div>

        {/* Section 2: Commonalities */}
        {(analysis.commonalities.themes.length > 0 ||
          analysis.commonalities.methods.length > 0 ||
          analysis.commonalities.gaps.length > 0) && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Microscope size={13} className="text-emerald-500" />
              <h4 className="text-xs font-medium">共同特征</h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {analysis.commonalities.themes.length > 0 && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground mb-1.5">研究主题</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.commonalities.themes.map((t, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {analysis.commonalities.methods.length > 0 && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground mb-1.5">常用方法</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.commonalities.methods.map((m, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{m}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {analysis.commonalities.gaps.length > 0 && (
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[10px] text-muted-foreground mb-1.5">研究空白</p>
                  <div className="flex flex-wrap gap-1">
                    {analysis.commonalities.gaps.map((g, i) => (
                      <Badge key={i} className="text-[10px] bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400">{g}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 3: Paper summaries */}
        {analysis.paperSummaries.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Search size={13} className="text-blue-500" />
              <h4 className="text-xs font-medium">论文速览</h4>
            </div>
            <div className="space-y-1.5">
              {analysis.paperSummaries.map((ps) => (
                <Link
                  key={ps.paperId}
                  href={`/reader/${ps.paperId}`}
                  className="flex items-start gap-2.5 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <ChevronRight size={14} className="shrink-0 mt-0.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{ps.title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {ps.summary}
                      {ps.contribution && (
                        <span className="text-blue-600 dark:text-blue-400"> — {ps.contribution}</span>
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Section 4: Clusters */}
        {analysis.clusters.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
              <h4 className="text-xs font-medium">论文聚类</h4>
            </div>
            <div className="space-y-2">
              {analysis.clusters.map((cluster, i) => (
                <div
                  key={i}
                  className={`border-l-2 rounded-r-lg px-3 py-2.5 ${CLUSTER_COLORS[i % CLUSTER_COLORS.length]}`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium">{cluster.label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {cluster.paperIds.length} 篇
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{cluster.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
      </CardContent>
    </Card>
  );
}
