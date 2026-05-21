'use client';

import { useRef, useCallback, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { renderMathInText } from '@/components/math-renderer';
import type { Paragraph, Highlight } from '@/types';

interface ParagraphCardProps {
  paragraph: Paragraph;
  isSelected: boolean;
  highlights: Highlight[];
  onSelect: (paragraph: Paragraph) => void;
  onTextSelected: (params: {
    paragraphId: string;
    text: string;
    startOffset: number;
    endOffset: number;
    rect: DOMRect;
  }) => void;
  onHighlightClick?: (highlight: Highlight, rect: DOMRect) => void;
}

const HIGHLIGHT_COLORS: Record<string, string> = {
  blue: 'bg-blue-200/50 dark:bg-blue-900/30',
  amber: 'bg-amber-50 dark:bg-amber-900/20',
  teal: 'bg-teal-50 dark:bg-teal-900/20',
  pink: 'bg-pink-50 dark:bg-pink-900/20',
};

function renderHighlightedText(
  text: string,
  highlights: Highlight[],
  onHighlightClick?: (highlight: Highlight, rect: DOMRect) => void,
): ReactNode[] {
  if (highlights.length === 0) {
    return [<span key="plain" dangerouslySetInnerHTML={{ __html: renderMathInText(text) }} />];
  }

  const sorted = [...highlights].sort((a, b) => a.startOffset - b.startOffset);
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (let i = 0; i < sorted.length; i++) {
    const h = sorted[i];

    if (h.endOffset <= cursor) continue;
    const start = Math.max(h.startOffset, cursor);

    if (cursor < start) {
      const segText = text.slice(cursor, start);
      parts.push(
        <span
          key={`t-${cursor}`}
          data-start={cursor}
          dangerouslySetInnerHTML={{ __html: renderMathInText(segText) }}
        />
      );
    }

    const end = h.endOffset;
    const hlText = text.slice(start, end);
    parts.push(
      <span
        key={`h-${h.id}`}
        data-start={start}
        data-highlight-id={h.id}
        data-color={h.color}
        className={cn(
          HIGHLIGHT_COLORS[h.color] || HIGHLIGHT_COLORS.blue,
          'rounded-sm cursor-pointer hover:opacity-80 transition-opacity',
        )}
        title={h.note || '点击管理高亮'}
        dangerouslySetInnerHTML={{ __html: renderMathInText(hlText) }}
        onClick={(e) => {
          e.stopPropagation();
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          onHighlightClick?.(h, rect);
        }}
      />
    );
    cursor = end;
  }

  if (cursor < text.length) {
    const tailText = text.slice(cursor);
    parts.push(
      <span
        key={`t-${cursor}`}
        data-start={cursor}
        dangerouslySetInnerHTML={{ __html: renderMathInText(tailText) }}
      />
    );
  }

  return parts;
}

function getAbsoluteOffset(container: Node, offset: number, root: HTMLElement): number {
  // Walk up from container to find the nearest element with data-start
  let node: Node | null = container;
  while (node && node !== root) {
    if (node instanceof HTMLElement && node.dataset.start != null) {
      return parseInt(node.dataset.start, 10) + offset;
    }
    // If container is a text node, its parent might have data-start
    if (node instanceof Text && node.parentElement && node.parentElement.dataset.start != null) {
      return parseInt(node.parentElement.dataset.start, 10) + offset;
    }
    node = node.parentNode;
  }
  return offset;
}

export default function ParagraphCard({
  paragraph,
  isSelected,
  highlights,
  onSelect,
  onTextSelected,
  onHighlightClick,
}: ParagraphCardProps) {
  const textRef = useRef<HTMLDivElement>(null);

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      // Small delay to let the selection settle
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        if (rect.width === 0 || rect.height === 0) return;

        const root = textRef.current;
        if (!root) return;

        const startOffset = getAbsoluteOffset(range.startContainer, range.startOffset, root);
        const endOffset = getAbsoluteOffset(range.endContainer, range.endOffset, root);
        const selectedText = selection.toString();

        onTextSelected({
          paragraphId: paragraph.id,
          text: selectedText,
          startOffset,
          endOffset,
          rect,
        });
      }, 10);
    },
    [paragraph.id, onTextSelected]
  );

  const highlightCount = highlights.length;

  return (
    <div
      onClick={() => onSelect(paragraph)}
      className={cn(
        'group relative cursor-pointer rounded-lg border px-4 py-3 mb-2 transition-all duration-200',
        isSelected
          ? 'bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
          : 'border-transparent hover:bg-muted/40'
      )}
    >
      <div
        ref={textRef}
        className="text-sm leading-relaxed text-foreground/85 whitespace-pre-line"
        onMouseUp={handleMouseUp}
      >
        {renderHighlightedText(paragraph.content, highlights, onHighlightClick)}
      </div>

      <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
          p.{paragraph.pageNumber}
        </span>
        {paragraph.section && paragraph.section !== 'Untitled' && (
          <span className="text-[11px] text-muted-foreground/70 truncate">
            {paragraph.section}
          </span>
        )}
        {highlightCount > 0 && (
          <span className="text-[11px] text-blue-500 ml-auto">
            {highlightCount} highlight{highlightCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}
