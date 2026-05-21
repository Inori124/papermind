'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface CitationTextProps {
  text: string;
  editable?: boolean;
  onChange?: (text: string) => void;
}

/**
 * 渲染学术文本，将参考文献中的 {{paperId:xxx}} 转为可点击链接
 *
 * 参考文献行格式示例：
 * [1] Maxwell et al. (2017). The Impact of School Climate... {{paperId:abc-123}}
 *
 * 渲染后 {{paperId:abc-123}} 变成一个 "查看原文" 的链接按钮
 */
export default function CitationText({ text, editable, onChange }: CitationTextProps) {
  const router = useRouter();

  // 将文本拆分为 正文部分 和 参考文献部分
  const { bodyText, references } = useMemo(() => {
    // 寻找参考文献列表的起始位置 —— 空行后以 [1] 或 [数字] 开头
    const refMatch = text.match(/\n\s*\n\s*(\[\d+\]|参考文献\s*\n|References?\s*\n)/);
    const splitIndex = refMatch?.index ?? -1;

    if (splitIndex === -1) {
      return { bodyText: text, references: [] };
    }

    const body = text.slice(0, splitIndex).trim();
    const refSection = text.slice(splitIndex).trim();

    // 解析每条参考文献
    const refLines = refSection.split('\n').filter(line => line.trim());
    const refs = refLines
      .filter(line => /^\[?\d+\]/.test(line.trim()))
      .map(line => {
        // 提取 paperId
        const paperIdMatch = line.match(/\{\{paperId:([^}]+)\}\}/);
        const paperId = paperIdMatch ? paperIdMatch[1].trim() : null;

        // 清理显示文本（去掉 {{paperId:xxx}} 标记）
        const displayText = line.replace(/\s*\{\{paperId:[^}]+\}\}\s*/g, '').trim();

        // 提取序号
        const numMatch = displayText.match(/^\[?(\d+)\]?/);
        const num = numMatch ? numMatch[1] : '';

        return { num, displayText, paperId };
      });

    return { bodyText: body, references: refs };
  }, [text]);

  // 拼接完整文本：正文 + 参考文献
  function rebuildFullText(newBody: string): string {
    if (references.length === 0) return newBody;
    const refText = '\n\n' + references.map(r => {
      const idTag = r.paperId ? ` {{paperId:${r.paperId}}}` : '';
      return `${r.displayText}${idTag}`;
    }).join('\n');
    return newBody + refText;
  }

  // 编辑模式
  if (editable && onChange) {
    return (
      <div>
        {/* 可编辑的正文 */}
        <textarea
          className="w-full text-sm leading-[1.9] bg-transparent resize-none focus:outline-none text-foreground text-justify mb-6"
          value={bodyText}
          onChange={(e) => onChange(rebuildFullText(e.target.value))}
          ref={(el) => {
            if (el) {
              el.style.height = 'auto';
              el.style.height = el.scrollHeight + 'px';
            }
          }}
        />

        {/* 参考文献列表（不可编辑，但可点击跳转） */}
        {references.length > 0 && (
          <ReferenceList references={references} router={router} />
        )}
      </div>
    );
  }

  // 只读模式
  return (
    <div>
      <div className="text-sm leading-[1.9] text-foreground whitespace-pre-line text-justify mb-6">
        {bodyText}
      </div>
      {references.length > 0 && (
        <ReferenceList references={references} router={router} />
      )}
    </div>
  );
}

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    if (match[2]) {
      parts.push(<strong key={match.index}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<em key={match.index} className="italic">{match[3]}</em>);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

// 参考文献列表组件
function ReferenceList({
  references,
  router,
}: {
  references: { num: string; displayText: string; paperId: string | null }[];
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div className="border-t border-border pt-4">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3">参考文献</p>
      <div className="space-y-2">
        {references.map((ref, i) => (
          <div key={i} className="flex items-start gap-2 group">
            <div className="flex-1 min-w-0">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {renderInlineMarkdown(ref.displayText)}
              </p>
            </div>
            {ref.paperId && (
              <button
                className="shrink-0 text-[10px] text-blue-500 hover:text-blue-600 hover:underline mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                onClick={() => router.push(`/reader/${ref.paperId}`)}
              >
                查看原文 →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
