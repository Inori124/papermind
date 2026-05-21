'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import PaperEditDialog from '@/components/paper-edit-dialog';
import { formatRelativeTime } from '@/lib/utils';
import type { Paper, Category } from '@/types';
import { PencilIcon, FolderIcon } from 'lucide-react';

interface PaperListProps {
  papers: Paper[];
  categories: Category[];
  onDelete: (id: string) => void;
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
}

export default function PaperList({ papers, categories, onDelete, onUpdate }: PaperListProps) {
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);

  if (papers.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {papers.map((paper, index) => (
          <div
            key={paper.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('paperId', paper.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="animate-fade-in cursor-grab active:cursor-grabbing"
            style={{ animationDelay: `${index * 0.04}s` }}
          >
            <div className="
              group border border-border rounded-xl p-4
              transition-all duration-200
              hover:border-foreground/15 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)]
              cursor-pointer
            ">
              <Link href={`/reader/${paper.id}`} className="block">
                {/* 标题 */}
                <h3 className="text-sm font-medium leading-snug line-clamp-2 mb-1.5 group-hover:text-foreground transition-colors">
                  {paper.title}
                </h3>

                {/* 作者 */}
                {paper.authors && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mb-3">
                    {paper.authors}
                  </p>
                )}

                {/* Metadata badges */}
                <MetadataBadges paper={paper} />

                {/* 进度条 */}
                {paper.totalParagraphs > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 ease-out"
                        style={{
                          width: `${paper.readProgress}%`,
                          background: paper.readProgress === 100
                            ? '#5DCAA5'
                            : paper.readProgress > 0
                              ? '#85B7EB'
                              : 'transparent',
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {Math.round(paper.readProgress)}%
                    </span>
                  </div>
                )}

                {/* 底部信息 */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{paper.totalParagraphs} 段</span>
                    <span>{paper.conceptCount} 概念</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {formatRelativeTime(paper.createdAt)}
                  </span>
                </div>
              </Link>

              {/* 操作栏 */}
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
                {/* 分类选择器 */}
                <CategoryDropdown
                  paper={paper}
                  categories={categories}
                  onUpdate={onUpdate}
                />

                <Link
                  href={`/reader/${paper.id}`}
                  className="flex-1 inline-flex items-center justify-center h-7 rounded-[min(var(--radius-md),12px)] border border-border bg-background text-[0.8rem] hover:bg-muted transition-colors duration-150"
                >
                  进入精读
                </Link>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  aria-label="编辑元数据"
                  onClick={(e) => {
                    e.preventDefault();
                    setEditingPaper(paper);
                  }}
                >
                  <PencilIcon className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    onDelete(paper.id);
                  }}
                >
                  删除
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editingPaper && (
        <PaperEditDialog
          paper={editingPaper}
          open={!!editingPaper}
          onOpenChange={(open) => { if (!open) setEditingPaper(null); }}
          onSave={async (id, data) => {
            await onUpdate(id, data);
            setEditingPaper(null);
          }}
        />
      )}
    </>
  );
}

function CategoryDropdown({
  paper,
  categories,
  onUpdate,
}: {
  paper: Paper;
  categories: Category[];
  onUpdate: (id: string, data: Record<string, unknown>) => Promise<void>;
}) {
  const currentCat = categories.find(c => c.id === paper.categoryId);
  const dotColor = currentCat?.color;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="h-7 w-7 inline-flex items-center justify-center rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
        aria-label="选择分类"
        onClick={(e) => e.preventDefault()}
      >
        {dotColor ? (
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: dotColor }}
          />
        ) : (
          <FolderIcon className="size-3.5" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[140px]">
        {categories.map((cat) => (
          <DropdownMenuItem
            key={cat.id}
            onClick={(e) => {
              e.preventDefault();
              onUpdate(paper.id, { categoryId: cat.id });
            }}
            className="flex items-center gap-2"
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-xs">{cat.name}</span>
            {paper.categoryId === cat.id && (
              <span className="ml-auto text-[10px] text-muted-foreground">当前</span>
            )}
          </DropdownMenuItem>
        ))}
        {paper.categoryId && (
          <DropdownMenuItem
            onClick={(e) => {
              e.preventDefault();
              onUpdate(paper.id, { categoryId: '' });
            }}
            className="text-xs text-muted-foreground"
          >
            清除分类
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MetadataBadges({ paper }: { paper: Paper }) {
  const badges: { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }[] = [];

  const displayYear = paper.publishYear || paper.year;
  if (displayYear) {
    badges.push({ label: `${displayYear}`, variant: 'secondary' });
  }

  if (paper.journal) {
    badges.push({ label: paper.journal, variant: 'outline' });
  }

  if (paper.impactFactor > 0) {
    badges.push({ label: `IF ${paper.impactFactor}`, variant: 'secondary', className: ifColor(paper.impactFactor) });
  }

  if (paper.jcrQuartile) {
    badges.push({ label: paper.jcrQuartile, variant: 'secondary', className: jcrColor(paper.jcrQuartile) });
  }

  if (paper.citationCount > 0) {
    badges.push({ label: `被引 ${paper.citationCount}`, variant: 'secondary' });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 mb-3">
      {badges.map((b) => (
        <Badge key={b.label} variant={b.variant} className={`text-[10px] h-5 ${b.className ?? ''}`}>
          {b.label}
        </Badge>
      ))}
    </div>
  );
}

function jcrColor(q: string): string {
  switch (q) {
    case 'Q1': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800';
    case 'Q2': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
    case 'Q3': return 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400 border-sky-200 dark:border-sky-800';
    case 'Q4': return 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800';
    default: return '';
  }
}

function ifColor(if_: number): string {
  if (if_ >= 10) return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800';
  if (if_ >= 5) return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800';
  if (if_ >= 2) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
  return 'bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400 border-slate-200 dark:border-slate-800';
}
