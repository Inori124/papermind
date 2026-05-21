'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowUp, Loader2, Copy, Check, RefreshCw, Trash2 } from 'lucide-react';
import CitationText from '@/components/citation-text';

interface WritingSession {
  id: string;
  title: string;
  prompt: string;
  style: string;
  language: string;
  content: string;
  updatedAt: string;
}

const STYLE_OPTIONS = [
  { key: 'academic', label: '学术论述' },
  { key: 'literature-review', label: '文献综述' },
  { key: 'summary', label: '简明摘要' },
  { key: 'critical', label: '批判分析' },
];

const REWRITE_ACTIONS = [
  { label: '润色', action: 'polish' },
  { label: '扩展', action: 'expand' },
  { label: '精简', action: 'condense' },
  { label: '换种说法', action: 'rephrase' },
];

export default function WritingPage() {
  const [sessions, setSessions] = useState<WritingSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('academic');
  const [language, setLanguage] = useState<'zh' | 'en'>('zh');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/writing/sessions');
      const data = await res.json();
      setSessions(Array.isArray(data) ? data : []);
    } catch { setSessions([]); }
  }

  async function handleGenerate() {
    if (!prompt.trim() || loading) return;
    setLoading(true);

    try {
      const res = await fetch('/api/writing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: prompt.trim(), style, language }),
      });
      const data = await res.json();
      const newContent = data.content || '';
      setContent(newContent);

      if (currentSessionId) {
        await fetch('/api/writing/sessions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentSessionId, content: newContent, prompt }),
        });
      } else {
        const sessionRes = await fetch('/api/writing/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, style, language, content: newContent }),
        });
        const session = await sessionRes.json();
        setCurrentSessionId(session.id);
      }

      fetchSessions();
    } catch {
      setContent('生成失败，请重试');
    } finally {
      setLoading(false);
    }
  }

  async function handleRewrite(action: string) {
    if (!content || rewriteLoading) return;
    setRewriteLoading(true);
    try {
      const res = await fetch('/api/writing/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, action }),
      });
      const data = await res.json();
      const newContent = data.content || content;
      setContent(newContent);

      if (currentSessionId) {
        await fetch('/api/writing/sessions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: currentSessionId, content: newContent }),
        });
      }
    } catch {} finally {
      setRewriteLoading(false);
    }
  }

  // Debounced auto-save when editing content
  useEffect(() => {
    if (!currentSessionId || !content) return;
    const timer = setTimeout(() => {
      fetch('/api/writing/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: currentSessionId, content }),
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [content, currentSessionId]);

  function loadSession(session: WritingSession) {
    setCurrentSessionId(session.id);
    setPrompt(session.prompt);
    setStyle(session.style || 'academic');
    setLanguage((session.language as 'zh' | 'en') || 'zh');
    setContent(session.content);
  }

  function handleNew() {
    setCurrentSessionId(null);
    setPrompt('');
    setContent('');
  }

  async function handleDeleteSession(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/writing/sessions?id=${id}`, { method: 'DELETE' });
    if (currentSessionId === id) handleNew();
    fetchSessions();
  }

  function handleCopy() {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  }

  function adjustTextareaHeight() {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  }


  function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return `${min}分钟前`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}小时前`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}天前`;
    return new Date(dateStr).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  const isHome = !content && !loading;

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">

      {/* ======== 输入区域 ======== */}
      <div className={`shrink-0 px-6 ${isHome ? 'pt-[15vh]' : 'pt-4'} pb-3 transition-all duration-300`}>
        <div className="max-w-[720px] mx-auto">

          {/* 输入框 + 发送按钮 */}
          <div className="relative border border-border rounded-2xl bg-background focus-within:border-foreground/20 transition-colors">
            <textarea
              ref={textareaRef}
              className="w-full text-sm px-4 pt-3 pb-10 bg-transparent resize-none focus:outline-none leading-relaxed"
              rows={1}
              placeholder="输入写作主题或论点..."
              value={prompt}
              onChange={(e) => { setPrompt(e.target.value); adjustTextareaHeight(); }}
              onKeyDown={handleKeyDown}
              disabled={loading}
            />

            {/* 底部工具栏（嵌入输入框内部） */}
            <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {STYLE_OPTIONS.map((s) => (
                  <button
                    key={s.key}
                    className={`text-[11px] px-2 py-0.5 rounded-md transition-colors ${
                      style === s.key
                        ? 'bg-foreground/10 text-foreground'
                        : 'text-muted-foreground/50 hover:text-muted-foreground'
                    }`}
                    onClick={() => setStyle(s.key)}
                  >
                    {s.label}
                  </button>
                ))}

                <div className="w-px h-3 bg-border mx-1" />

                <button
                  className={`text-[11px] px-1.5 py-0.5 rounded-md transition-colors ${
                    language === 'zh' ? 'text-foreground bg-foreground/10' : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}
                  onClick={() => setLanguage('zh')}
                >
                  中
                </button>
                <button
                  className={`text-[11px] px-1.5 py-0.5 rounded-md transition-colors ${
                    language === 'en' ? 'text-foreground bg-foreground/10' : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}
                  onClick={() => setLanguage('en')}
                >
                  EN
                </button>
              </div>

              <button
                className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-30"
                onClick={handleGenerate}
                disabled={!prompt.trim() || loading}
              >
                {loading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <ArrowUp size={14} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ======== 主内容区域 ======== */}
      <div className="flex-1 overflow-y-auto px-6">
        <div className="max-w-[720px] mx-auto pb-12">

          {/* —— 状态 A：空白首页，显示历史卡片画廊 —— */}
          {isHome && (
            <div className="mt-8">
              {sessions.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs text-muted-foreground">历史记录</p>
                    <button
                      className="text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                      onClick={handleNew}
                    >
                      新建
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {sessions.slice(0, 20).map((session) => (
                      <div
                        key={session.id}
                        className="group border border-border rounded-xl p-3.5 cursor-pointer hover:border-foreground/15 hover:shadow-[0_1px_3px_rgba(0,0,0,0.04)] transition-all relative"
                        onClick={() => loadSession(session)}
                      >
                        <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 mb-1.5 pr-6">
                          {session.title || session.prompt.slice(0, 30)}
                        </p>

                        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3 mb-2">
                          {session.content?.slice(0, 120) || '空内容'}
                        </p>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground/50">
                            {timeAgo(session.updatedAt)}
                          </span>
                          <span className="text-[10px] text-muted-foreground/30">
                            {session.content?.length || 0}字
                          </span>
                        </div>

                        <button
                          className="absolute top-2.5 right-2.5 p-1 rounded-md text-muted-foreground/0 group-hover:text-muted-foreground/40 hover:!text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all"
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          title="删除"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {sessions.length === 0 && (
                <p className="text-center text-sm text-muted-foreground/40 mt-4">
                  输入主题，按 Enter 生成
                </p>
              )}
            </div>
          )}

          {/* —— 状态 B：加载中 —— */}
          {loading && !content && (
            <div className="mt-8 space-y-3">
              {[95, 100, 88, 75, 92, 60].map((w, i) => (
                <div
                  key={i}
                  className="h-4 skeleton-shimmer rounded"
                  style={{ width: `${w}%`, animationDelay: `${i * 0.08}s` }}
                />
              ))}
            </div>
          )}

          {/* —— 状态 C：有生成内容 —— */}
          {content && (
            <div className="mt-4 animate-fade-in">

              {/* 工具栏 */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1">
                  {REWRITE_ACTIONS.map((ra) => (
                    <button
                      key={ra.label}
                      className="text-[11px] px-2.5 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                      onClick={() => handleRewrite(ra.action)}
                      disabled={rewriteLoading}
                    >
                      {ra.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground/50">
                    {content.length}字
                  </span>
                  <button
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={handleGenerate}
                    title="重新生成"
                  >
                    <RefreshCw size={13} />
                  </button>
                  <button
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    onClick={handleCopy}
                    title="复制"
                  >
                    {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                  </button>
                </div>
              </div>

              {/* 可编辑内容（含引文解析） */}
              <CitationText
                text={content}
                editable
                onChange={(newText) => setContent(newText)}
              />

              {/* 底部返回按钮 */}
              <div className="mt-8 text-center">
                <button
                  className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  onClick={handleNew}
                >
                  ← 返回
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
