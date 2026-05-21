'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, MessageSquare, FileText, HelpCircle, Star } from 'lucide-react';

interface Annotation {
  id: string;
  paragraphId: string;
  paperId: string;
  content: string;
  type: 'note' | 'question' | 'important';
  createdAt: string;
}

interface NotesPanelProps {
  paperId: string;
  paragraphId: string | null;
  paragraphContent: string | null;
}

const TYPE_CONFIG = {
  note: { label: '笔记', icon: MessageSquare, color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  question: { label: '疑问', icon: HelpCircle, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30' },
  important: { label: '重点', icon: Star, color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
};

export default function NotesPanel({ paperId, paragraphId, paragraphContent }: NotesPanelProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [allAnnotations, setAllAnnotations] = useState<Annotation[]>([]);
  const [viewMode, setViewMode] = useState<'paragraph' | 'all'>('paragraph');
  const [isAdding, setIsAdding] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [newType, setNewType] = useState<'note' | 'question' | 'important'>('note');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!paragraphId) return;
    fetchAnnotations();
  }, [paragraphId]);

  useEffect(() => {
    fetchAllAnnotations();
  }, [paperId]);

  async function fetchAnnotations() {
    if (!paragraphId) return;
    try {
      const res = await fetch(`/api/annotate?paperId=${paperId}&paragraphId=${paragraphId}`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data);
      }
    } catch { /* ignore */ }
  }

  async function fetchAllAnnotations() {
    try {
      const res = await fetch(`/api/annotate?paperId=${paperId}`);
      if (res.ok) {
        const data = await res.json();
        setAllAnnotations(data);
      }
    } catch { /* ignore */ }
  }

  async function handleAddNote() {
    if (!newNote.trim() || !paragraphId) return;
    setLoading(true);
    try {
      const res = await fetch('/api/annotate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paragraphId,
          paperId,
          content: newNote.trim(),
          type: newType,
        }),
      });
      if (res.ok) {
        setNewNote('');
        setIsAdding(false);
        fetchAnnotations();
        fetchAllAnnotations();
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  async function handleUpdateNote(id: string) {
    if (!editContent.trim()) return;
    try {
      await fetch('/api/annotate', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, content: editContent.trim() }),
      });
      setEditingId(null);
      fetchAnnotations();
      fetchAllAnnotations();
    } catch { /* ignore */ }
  }

  async function handleDeleteNote(id: string) {
    try {
      await fetch(`/api/annotate?id=${id}`, { method: 'DELETE' });
      fetchAnnotations();
      fetchAllAnnotations();
    } catch { /* ignore */ }
  }

  const displayAnnotations = viewMode === 'paragraph' ? annotations : allAnnotations;

  return (
    <div className="flex flex-col h-full">
      {/* View mode toggle */}
      <div className="flex items-center gap-1 px-1 pb-3 border-b border-border mb-3 shrink-0">
        <button
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
            viewMode === 'paragraph'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:bg-muted'
          }`}
          onClick={() => setViewMode('paragraph')}
        >
          当前段落
        </button>
        <button
          className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
            viewMode === 'all'
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:bg-muted'
          }`}
          onClick={() => setViewMode('all')}
        >
          全部笔记
          {allAnnotations.length > 0 && (
            <span className="ml-1 text-[10px] opacity-60">({allAnnotations.length})</span>
          )}
        </button>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {displayAnnotations.length === 0 && !isAdding && (
          <div className="text-center py-8">
            <FileText size={32} className="mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
            <p className="text-xs text-muted-foreground">
              {viewMode === 'paragraph' ? '这个段落还没有笔记' : '这篇论文还没有笔记'}
            </p>
            {viewMode === 'paragraph' && paragraphId && (
              <button
                className="text-xs text-blue-600 hover:underline mt-2"
                onClick={() => setIsAdding(true)}
              >
                添加第一条笔记
              </button>
            )}
          </div>
        )}

        {displayAnnotations.map((annotation) => {
          const typeConfig = TYPE_CONFIG[annotation.type] || TYPE_CONFIG.note;
          const Icon = typeConfig.icon;
          const isEditing = editingId === annotation.id;

          return (
            <div key={annotation.id} className="group bg-background border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${typeConfig.color}`}>
                  <Icon size={10} />
                  {typeConfig.label}
                </span>

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  {!isEditing && (
                    <>
                      <button
                        className="p-1 rounded hover:bg-muted text-muted-foreground text-xs"
                        onClick={() => { setEditingId(annotation.id); setEditContent(annotation.content); }}
                      >
                        编辑
                      </button>
                      <button
                        className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500"
                        onClick={() => handleDeleteNote(annotation.id)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {isEditing ? (
                <div>
                  <textarea
                    className="w-full text-sm border border-border rounded-md p-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
                    rows={3}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    autoFocus
                  />
                  <div className="flex justify-end gap-1.5 mt-1.5">
                    <button
                      className="text-xs px-2 py-1 rounded text-muted-foreground hover:bg-muted"
                      onClick={() => setEditingId(null)}
                    >
                      取消
                    </button>
                    <button
                      className="text-xs px-2 py-1 rounded bg-foreground text-background"
                      onClick={() => handleUpdateNote(annotation.id)}
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                  {annotation.content}
                </p>
              )}

              <p className="text-[10px] text-muted-foreground mt-2">
                {new Date(annotation.createdAt).toLocaleString('zh-CN', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </p>
            </div>
          );
        })}
      </div>

      {/* Add note area */}
      {viewMode === 'paragraph' && paragraphId && (
        <div className="shrink-0 border-t border-border pt-3 mt-3">
          {isAdding ? (
            <div>
              <div className="flex gap-1.5 mb-2">
                {(Object.entries(TYPE_CONFIG) as [string, typeof TYPE_CONFIG.note][]).map(([key, config]) => {
                  const TIcon = config.icon;
                  return (
                    <button
                      key={key}
                      className={`inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors ${
                        newType === key
                          ? 'border-foreground bg-foreground text-background'
                          : 'border-border text-muted-foreground hover:border-foreground/30'
                      }`}
                      onClick={() => setNewType(key as typeof newType)}
                    >
                      <TIcon size={11} />
                      {config.label}
                    </button>
                  );
                })}
              </div>
              <textarea
                className="w-full text-sm border border-border rounded-md p-2.5 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-blue-300"
                rows={3}
                placeholder="写下你的想法..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddNote();
                }}
              />
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-muted-foreground">⌘ + Enter 保存</span>
                <div className="flex gap-1.5">
                  <button
                    className="text-xs px-3 py-1.5 rounded-md text-muted-foreground hover:bg-muted"
                    onClick={() => { setIsAdding(false); setNewNote(''); }}
                  >
                    取消
                  </button>
                  <button
                    className="text-xs px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 disabled:opacity-50"
                    onClick={handleAddNote}
                    disabled={!newNote.trim() || loading}
                  >
                    {loading ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-2 rounded-md border border-dashed border-border hover:border-foreground/30 hover:text-foreground transition-colors"
              onClick={() => setIsAdding(true)}
            >
              <Plus size={14} />
              添加笔记
            </button>
          )}
        </div>
      )}
    </div>
  );
}
