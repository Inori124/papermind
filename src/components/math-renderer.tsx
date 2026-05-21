'use client';

import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  text: string;
  className?: string;
}

/**
 * 将文本中的 LaTeX 公式渲染为 HTML
 * 支持行内公式 $...$ 和块级公式 $$...$$
 */
export default function MathRenderer({ text, className }: MathRendererProps) {
  const rendered = useMemo(() => renderMathInText(text), [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

/**
 * 纯函数版本：渲染文本中的 LaTeX 公式，返回 HTML 字符串
 * 可在非组件上下文中使用（如 renderHighlightedText）
 */
export function renderMathInText(text: string): string {
  // 先处理块级公式 $$...$$
  let result = text.replace(/\$\$([\s\S]+?)\$\$/g, (_, math) => {
    try {
      return katex.renderToString(math.trim(), {
        displayMode: true,
        throwOnError: false,
        output: 'html',
      });
    } catch {
      return `<code>${escapeHtml(math)}</code>`;
    }
  });

  // 再处理行内公式 $...$（排除金额如 $100）
  result = result.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_, math) => {
    if (/^\d+([.,]\d+)?$/.test(math.trim())) return `$${math}$`;
    try {
      return katex.renderToString(math.trim(), {
        displayMode: false,
        throwOnError: false,
        output: 'html',
      });
    } catch {
      return `<code>${escapeHtml(math)}</code>`;
    }
  });

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
