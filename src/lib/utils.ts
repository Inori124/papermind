import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} 周前`;
  return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

export function renderMarkdown(text: string): string {
  let html = text
    // Escape HTML entities first (except what we'll add)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/__(.+?)__/g, '<strong class="font-semibold text-foreground">$1</strong>')

    // Inline code: `text`
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs font-mono">$1</code>')

    // Horizontal rules: --- or ***
    .replace(/^(---|\*\*\*)$/gm, '<hr class="my-3 border-border" />')

    // 「术语」：定义 → styled term definitions
    .replace(/「(.+?)」/g, '<span class="inline-flex items-center gap-1 rounded bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">$1</span>')

    // Headings: ## Title
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold mt-4 mb-2">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-semibold mt-5 mb-2">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-3">$1</h2>')

    // Unordered lists: - item or * item
    .replace(/^[*-] (.+)$/gm, '<li class="ml-4 list-disc my-0.5">$1</li>')

    // Ordered lists: 1. item
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal my-0.5">$1</li>')

    // Double newlines → paragraph breaks
    .replace(/\n\n/g, '</p><p class="my-2">')

    // Single newlines → <br>
    .replace(/\n/g, '<br />')

  // Wrap in paragraph
  html = '<p class="my-2">' + html + '</p>'

  // Fix adjacent lists (don't wrap list items in extra p tags)
  html = html.replace(/<\/p><p class="my-2"><li/g, '<li')
  html = html.replace(/<\/li><br \/><li/g, '</li><li')
  html = html.replace(/<\/li><\/p>/g, '</li>')

  // Clean up empty paragraphs
  html = html.replace(/<p class="my-2"><\/p>/g, '')
  html = html.replace(/<p class="my-2"><br \/><\/p>/g, '')

  // Fix: unwrap content trapped in extra p tags around block elements
  html = html.replace(/<p class="my-2"><h([234])/g, '<h$1')
  html = html.replace(/<\/h([234])><br \/><\/p>/g, '</h$1>')
  html = html.replace(/<p class="my-2"><hr/g, '<hr')
  html = html.replace(/\/><br \/><\/p>/g, '/>')

  return html
}
