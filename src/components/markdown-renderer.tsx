'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-lg font-semibold mt-4 mb-2">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-3 mb-2">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-3 mb-1.5">{children}</h3>
          ),
          p: ({ children }) => (
            <p className="text-sm leading-relaxed mb-2 text-foreground">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-muted-foreground">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside text-sm space-y-1 mb-2 ml-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside text-sm space-y-1 mb-2 ml-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-sm leading-relaxed">{children}</li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-blue-300 pl-3 my-2 text-sm text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          code: ({ children, className: codeClass }) => {
            const isInline = !codeClass;
            if (isInline) {
              return (
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                  {children}
                </code>
              );
            }
            return (
              <pre className="bg-muted rounded-md p-3 my-2 overflow-x-auto">
                <code className="text-xs font-mono">{children}</code>
              </pre>
            );
          },
          hr: () => <hr className="my-3 border-border" />,
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 hover:underline text-sm" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="text-sm border-collapse w-full">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border px-2 py-1 bg-muted text-left text-xs font-medium">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-border px-2 py-1 text-xs">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
