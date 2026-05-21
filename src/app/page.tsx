'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { usePapers } from '@/hooks/use-paper';
import PaperUpload from '@/components/paper-upload';
import PaperList from '@/components/paper-list';
import FolderAnalysis from '@/components/folder-analysis';
import ConfirmDialog from '@/components/confirm-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import type { Category } from '@/types';

export default function HomePage() {
  const { papers, loading, refetch, deletePaper, updatePaper } = usePapers();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [currentFolderName, setCurrentFolderName] = useState('');

  const searchParams = useSearchParams();
  const activeFolderId = searchParams.get('folder');

  // 加载分类
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setCategories(data); })
      .catch(() => {});
  }, [papers]);

  // 获取当前文件夹名称
  useEffect(() => {
    if (activeFolderId) {
      fetch('/api/folders').then(r => r.json()).then(folders => {
        const folder = (folders as any[]).find((f: any) => f.id === activeFolderId);
        setCurrentFolderName(folder?.name || '');
      }).catch(() => {});
    } else {
      setCurrentFolderName('');
    }
  }, [activeFolderId]);

  // 回到首页时自动刷新阅读进度（SPA 路由切换会触发 mount）
  // 额外监听 window focus 用于切回浏览器标签页的场景
  useEffect(() => {
    function handleFocus() {
      refetch();
    }
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetch]);

  const handleDelete = async (id: string) => {
    try {
      await deletePaper(id);
      toast.success('已删除');
    } catch {
      toast.error('删除失败');
    }
  };

  const handleUpdate = async (id: string, data: Record<string, unknown>) => {
    try {
      await updatePaper(id, data);
      toast.success('元数据已更新');
    } catch {
      toast.error('更新失败');
    }
  };

  // Filter papers by folder first, then by category
  let filteredPapers = activeFolderId
    ? papers.filter(p => p.folderId === activeFolderId)
    : papers;

  filteredPapers = activeCategory === 'all'
    ? filteredPapers
    : filteredPapers.filter(p => p.categoryId === activeCategory);

  return (
    <div className="max-w-5xl mx-auto px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {currentFolderName || '我的文献库'}
          </h2>
          {currentFolderName && (
            <p className="text-sm text-muted-foreground mt-1">
              文件夹 · {filteredPapers.length} 篇论文
            </p>
          )}
          {!currentFolderName && (
            <p className="text-sm text-muted-foreground mt-1">
              拖拽上传 PDF，AI 辅助精读
            </p>
          )}
        </div>
      </div>

      {/* Category filter bar */}
      {categories.length > 0 && (
        <div className="flex items-center gap-1.5 mb-6 flex-wrap">
          <button
            onClick={() => setActiveCategory('all')}
            className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-medium transition-colors ${
              activeCategory === 'all'
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
            }`}
          >
            全部
            <span className="ml-1.5 text-[10px] opacity-70">{papers.length}</span>
          </button>
          {categories.map((cat) => {
            const count = papers.filter(p => p.categoryId === cat.id).length;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`inline-flex items-center h-7 px-3 rounded-full text-xs font-medium transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-foreground text-background'
                    : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80'
                }`}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1.5"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.name}
                <span className="ml-1.5 text-[10px] opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!loading && papers.length === 0 && (
        <PaperUpload onUploaded={refetch} />
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Paper list */}
      {!loading && papers.length > 0 && (
        <div className="space-y-6">
          <PaperUpload onUploaded={refetch} />
          {activeFolderId && <FolderAnalysis folderId={activeFolderId} />}
          <PaperList
            papers={filteredPapers}
            categories={categories}
            onDelete={setDeleteTarget}
            onUpdate={handleUpdate}
          />
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        title="删除论文"
        description="删除后该论文的所有段落、笔记、高亮和概念都会被清除，且无法恢复。"
        onConfirm={() => {
          handleDelete(deleteTarget!);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
