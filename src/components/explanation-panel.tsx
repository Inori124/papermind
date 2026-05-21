'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, NotebookPen, BookOpenText,
  Send, RotateCcw,
} from 'lucide-react';
import NotesPanel from '@/components/notes-panel';
import MathRenderer from '@/components/math-renderer';

interface ExplainResult {
  summary: string;
  sentences: { original: string; explanation: string }[];
  keyTerms: { term: string; definition: string }[];
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  type: 'explanation' | 'text';
  explanationData?: ExplainResult;
}

interface ExplanationPanelProps {
  paperId: string;
  paragraphId: string | null;
  paragraphContent: string | null;
  paragraphSection?: string;
  paragraphPage?: number;
}

const QUICK_QUESTIONS = [
  { label: '用更简单的话解释', prompt: '能不能用更简单的大白话重新解释一下这段话？' },
  { label: '举个例子', prompt: '能举一个具体的例子来帮助我理解吗？' },
  { label: '为什么重要', prompt: '这段话的核心观点为什么重要？它对整篇论文有什么意义？' },
  { label: '和前文的关系', prompt: '这段话和前面的内容有什么逻辑关系？' },
  { label: '方法论细节', prompt: '这里提到的研究方法能展开讲讲吗？具体是怎么做的？' },
];

export default function ExplanationPanel({
  paperId,
  paragraphId,
  paragraphContent,
  paragraphSection,
  paragraphPage,
}: ExplanationPanelProps) {
  const [activeTab, setActiveTab] = useState<'explain' | 'notes'>('explain');
  const [chatHistories, setChatHistories] = useState<Record<string, ChatMessage[]>>({});
  const [loading, setLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [latestSummary, setLatestSummary] = useState<string | null>(null);
  const [regenerateKey, setRegenerateKey] = useState(0);

  // Fetch latest reading insight summary for this paper
  useEffect(() => {
    if (!paperId) return;
    fetch(`/api/memory?paperId=${paperId}&type=summary&latest=true`)
      .then(r => r.json())
      .then(data => {
        if (data.content) setLatestSummary(data.content);
      })
      .catch(() => {});
  }, [paperId, paragraphId]);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const currentHistory = paragraphId ? (chatHistories[paragraphId] || []) : [];

  function scrollToBottom() {
    setTimeout(() => {
      chatContainerRef.current?.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }, 50);
  }

  // When paragraph changes, cancel previous and fetch new explanation
  useEffect(() => {
    if (!paragraphId || !paragraphContent) return;

    // Cancel previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const abortController = new AbortController();
    abortRef.current = abortController;

    async function fetchExplanation() {
      setLoading(true);
      setError(null);

      try {
        // Mark as read (fire-and-forget)
        fetch(`/api/papers/${paperId}/paragraphs/read`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paragraphId }),
        }).catch(() => {});

        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            paperId,
            paragraphId,
            content: paragraphContent,
            context: paragraphSection && paragraphSection !== 'Untitled'
              ? `Section: ${paragraphSection}`
              : undefined,
          }),
          signal: abortController.signal,
        });

        if (abortController.signal.aborted) return;
        if (!res.ok) throw new Error('请求失败');
        const data: ExplainResult = await res.json();

        if (abortController.signal.aborted) return;

        const explanationMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
          type: 'explanation',
          explanationData: data,
        };

        setChatHistories(prev => ({
          ...prev,
          [paragraphId!]: [explanationMessage],
        }));

        scrollToBottom();
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        setError('AI 解释生成失败，请重试');
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchExplanation();

    return () => {
      abortController.abort();
    };
  }, [paragraphId, paragraphContent, regenerateKey]);

  async function handleSendMessage(messageText?: string) {
    const text = messageText || inputValue.trim();
    if (!text || !paragraphId || !paragraphContent) return;

    setInputValue('');
    setChatLoading(true);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      type: 'text',
    };

    const updatedHistory = [...currentHistory, userMessage];
    setChatHistories(prev => ({
      ...prev,
      [paragraphId!]: updatedHistory,
    }));

    scrollToBottom();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperId,
          paragraphId,
          paragraphContent,
          history: updatedHistory,
          userMessage: text,
        }),
      });

      if (!res.ok) throw new Error('请求失败');
      const data = await res.json();

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      setChatHistories(prev => ({
        ...prev,
        [paragraphId!]: [...updatedHistory, assistantMessage],
      }));

      scrollToBottom();
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '回复失败，请重试。',
        timestamp: new Date().toISOString(),
        type: 'text',
      };

      setChatHistories(prev => ({
        ...prev,
        [paragraphId!]: [...updatedHistory, errorMessage],
      }));
    } finally {
      setChatLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleRegenerate() {
    if (!paragraphId) return;
    setChatHistories(prev => ({ ...prev, [paragraphId!]: [] }));
    setRegenerateKey(k => k + 1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }

  // Empty state
  if (!paragraphId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <BookOpenText size={48} strokeWidth={1} className="mb-3 opacity-40" />
        <p className="text-sm">点击左侧段落</p>
        <p className="text-sm">获取 AI 解释</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* Tab bar */}
      <div className="flex border-b border-border shrink-0">
        <button
          onClick={() => setActiveTab('explain')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'explain'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sparkles size={14} />
          AI 解释
        </button>
        <button
          onClick={() => setActiveTab('notes')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors border-b-2 ${
            activeTab === 'notes'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <NotebookPen size={14} />
          我的笔记
        </button>
      </div>

      {/* AI Explain tab */}
      {activeTab === 'explain' && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Chat area */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">

            {loading && <LoadingSkeleton />}

            {/* Reading insight card */}
            {latestSummary && !loading && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900 rounded-lg text-xs leading-relaxed animate-fade-in">
                <div className="flex items-center gap-1.5 mb-1.5 text-amber-700 dark:text-amber-300">
                  <Sparkles size={12} />
                  <span className="font-medium">阅读洞察</span>
                </div>
                <p className="text-foreground">{latestSummary}</p>
              </div>
            )}

            {error && (
              <div className="text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg p-3 flex items-center justify-between">
                <span>{error}</span>
                <button
                  className="text-xs underline ml-2 shrink-0"
                  onClick={handleRegenerate}
                >
                  重试
                </button>
              </div>
            )}

            {/* Chat messages */}
            {currentHistory.map((msg) => (
              <div key={msg.id} className="animate-fade-in">
                {msg.role === 'assistant' && msg.type === 'explanation' && msg.explanationData ? (
                  <ExplanationCard data={msg.explanationData} onRegenerate={handleRegenerate} />
                ) : msg.role === 'assistant' ? (
                  <div className="flex gap-2.5">
                    <div className="shrink-0 w-6 h-6 rounded-full bg-foreground/5 flex items-center justify-center mt-0.5">
                      <Sparkles size={12} className="text-foreground/50" />
                    </div>
                    <div className="flex-1 bg-muted/40 rounded-lg rounded-tl-sm p-3">
                      <p className="text-sm leading-relaxed whitespace-pre-line">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] bg-foreground text-background rounded-lg rounded-tr-sm px-3 py-2">
                      <p className="text-sm leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {chatLoading && (
              <div className="flex gap-2.5 animate-fade-in">
                <div className="shrink-0 w-6 h-6 rounded-full bg-foreground/5 flex items-center justify-center mt-0.5">
                  <Sparkles size={12} className="text-foreground/50" />
                </div>
                <div className="bg-muted/40 rounded-lg rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="shrink-0 border-t border-border">

            {/* Quick questions — only when there's just the initial explanation */}
            {currentHistory.length === 1 && !chatLoading && (
              <div className="px-3 pt-3 pb-1 flex gap-1.5 overflow-x-auto scrollbar-hide">
                {QUICK_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    className="shrink-0 text-[11px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors"
                    onClick={() => handleSendMessage(q.prompt)}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            {/* Input box */}
            <div className="p-3 flex items-end gap-2">
              <textarea
                ref={inputRef}
                className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-background resize-none focus:outline-none focus:ring-1 focus:ring-foreground/20 min-h-[36px] max-h-[100px]"
                rows={1}
                placeholder="对这段内容有疑问？直接问..."
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px';
                }}
                onKeyDown={handleKeyDown}
                disabled={loading || chatLoading}
              />
              <button
                className="shrink-0 w-8 h-8 rounded-lg bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || loading || chatLoading}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notes tab */}
      {activeTab === 'notes' && (
        <div className="flex-1 overflow-y-auto p-4">
          <NotesPanel
            paperId={paperId}
            paragraphId={paragraphId}
            paragraphContent={paragraphContent}
          />
        </div>
      )}
    </div>
  );
}

// ===== Structured explanation card =====

function ExplanationCard({
  data,
  onRegenerate,
}: {
  data: ExplainResult;
  onRegenerate: () => void;
}) {
  return (
    <div className="space-y-3">

      {/* Summary */}
      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 rounded-lg p-3">
        <p className="text-[11px] text-blue-600 dark:text-blue-400 mb-1 font-medium">一句话总结</p>
        <p className="text-sm leading-relaxed text-blue-900 dark:text-blue-100">
          <MathRenderer text={data.summary} />
        </p>
      </div>

      {/* Sentence by sentence */}
      <div>
        <p className="text-[11px] text-muted-foreground mb-2 font-medium">逐句解释</p>
        <div className="space-y-2">
          {data.sentences.map((s, i) => (
            <div key={i} className="bg-background border border-border rounded-lg p-3">
              <p className="text-xs text-muted-foreground italic mb-1.5 line-clamp-2">
                &ldquo;<MathRenderer text={s.original} />&rdquo;
              </p>
              <p className="text-sm leading-relaxed">
                <MathRenderer text={s.explanation} />
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Key terms */}
      {data.keyTerms && data.keyTerms.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-2 font-medium">关键术语</p>
          <div className="space-y-2">
            {data.keyTerms.map((t, i) => (
              <div key={i} className="bg-background border border-border rounded-lg p-2.5">
                <span className="inline-block text-xs font-medium bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded mb-1.5">
                  <MathRenderer text={t.term} />
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <MathRenderer text={t.definition} />
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Regenerate */}
      <div className="flex justify-end">
        <button
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
          onClick={onRegenerate}
        >
          <RotateCcw size={11} />
          重新生成
        </button>
      </div>
    </div>
  );
}

// ===== Loading skeleton =====

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-lg p-3 bg-muted/30">
        <div className="h-3 skeleton-shimmer rounded w-20 mb-2" />
        <div className="h-4 skeleton-shimmer rounded w-full mb-1.5" />
        <div className="h-4 skeleton-shimmer rounded w-3/4" />
      </div>
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg p-3 bg-muted/20">
          <div className="h-3 skeleton-shimmer rounded w-5/6 mb-2" />
          <div className="h-4 skeleton-shimmer rounded w-full mb-1.5" />
          <div className="h-4 skeleton-shimmer rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}
