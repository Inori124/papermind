'use client';

import { useState } from 'react';
import PdfLoader from 'react-pdf-highlighter-extended/dist/esm/components/PdfLoader';
import PdfHighlighter from 'react-pdf-highlighter-extended/dist/esm/components/PdfHighlighter';
import TextHighlight from 'react-pdf-highlighter-extended/dist/esm/components/TextHighlight';
import AreaHighlight from 'react-pdf-highlighter-extended/dist/esm/components/AreaHighlight';
import {
  useHighlightUtils,
} from 'react-pdf-highlighter-extended/dist/esm/contexts/HighlightContext';
import {
  useSelectionUtils,
} from 'react-pdf-highlighter-extended/dist/esm/contexts/SelectionContext';
import type { Highlight } from 'react-pdf-highlighter-extended/dist/esm/types';

export interface CustomHighlight extends Highlight {
  color?: string;
}

const HIGHLIGHT_COLORS = [
  { key: 'blue',  label: '概念', color: '#B5D4F4' },
  { key: 'amber', label: '发现', color: '#FAE0A8' },
  { key: 'teal',  label: '方法', color: '#A8E6CF' },
  { key: 'pink',  label: '疑问', color: '#F4B5CC' },
];

interface PdfReaderProps {
  pdfUrl: string;
  highlights: CustomHighlight[];
  onAddHighlight: (highlight: CustomHighlight) => void;
  onDeleteHighlight: (id: string) => void;
  onUpdateHighlight: (id: string, updates: { color?: string; comment?: { text: string } }) => void;
  onTextSelect: (text: string) => void;
  onHighlightClick?: (highlight: CustomHighlight, event: React.MouseEvent) => void;
}

export default function PdfReader({
  pdfUrl,
  highlights,
  onAddHighlight,
  onDeleteHighlight,
  onUpdateHighlight,
  onTextSelect,
  onHighlightClick,
}: PdfReaderProps) {
  return (
    <div className="h-full w-full" style={{ position: 'relative' }}>
      <PdfLoader
        document={pdfUrl}
        workerSrc="/pdf.worker.min.js"
        beforeLoad={() => (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground animate-pulse">
            正在加载 PDF...
          </div>
        )}
      >
        <PdfHighlighter
          highlights={highlights}
          onSelectionFinished={(sel) => {
            const text = sel.selectionContent?.text || '';
            if (text.trim()) onTextSelect(text.trim());
          }}
          selectionTip={<ColorPickerTip onPick={onAddHighlight} />}
          enableAreaSelection={(event) => event.altKey}
          style={{ width: '100%', height: '100%' }}
        >
          <HighlightRenderer
            onDeleteHighlight={onDeleteHighlight}
            onUpdateHighlight={onUpdateHighlight}
            onHighlightClick={onHighlightClick}
          />
        </PdfHighlighter>
      </PdfLoader>
    </div>
  );
}

// Color picker shown in selection tip
function ColorPickerTip({ onPick }: { onPick: (h: CustomHighlight) => void }) {
  const { selectionPosition, selectionContent } = useSelectionUtils();
  const [selectedColor, setSelectedColor] = useState('blue');

  function handlePick(color: string) {
    onPick({
      id: crypto.randomUUID(),
      content: selectionContent,
      position: selectionPosition,
      comment: { text: '' },
      color,
    });
  }

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-2 flex items-center gap-1.5 animate-fade-in">
      {HIGHLIGHT_COLORS.map((c) => (
        <button
          key={c.key}
          title={c.label}
          className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
            selectedColor === c.key ? 'border-foreground scale-110' : 'border-transparent'
          }`}
          style={{ backgroundColor: c.color }}
          onClick={() => handlePick(c.key)}
        />
      ))}
    </div>
  );
}

// Renders each highlight inside PdfHighlighter
function HighlightRenderer({
  onDeleteHighlight,
  onUpdateHighlight,
  onHighlightClick,
}: {
  onDeleteHighlight: (id: string) => void;
  onUpdateHighlight: (id: string, updates: { color?: string; comment?: { text: string } }) => void;
  onHighlightClick?: (highlight: CustomHighlight, event: React.MouseEvent) => void;
}) {
  const { highlight, isScrolledTo } = useHighlightUtils();
  const customHighlight = highlight as CustomHighlight;
  const isArea = !!(customHighlight.content?.image);

  const bgColor = getColorValue(customHighlight.color || 'blue');

  if (isArea) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onHighlightClick?.(customHighlight, e);
        }}
        style={{ cursor: 'pointer' }}
      >
        <AreaHighlight
          highlight={highlight}
          isScrolledTo={isScrolledTo}
          onChange={() => {}}
          onEditStart={() => {}}
          style={{
            background: bgColor,
            mixBlendMode: 'multiply',
          }}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onHighlightClick?.(customHighlight, e);
      }}
      style={{ cursor: 'pointer' }}
    >
      <TextHighlight
        highlight={highlight}
        isScrolledTo={isScrolledTo}
        style={{
          background: bgColor,
          mixBlendMode: 'multiply',
        }}
      />
    </div>
  );
}

function getColorValue(colorKey: string): string {
  const map: Record<string, string> = {
    blue:  'rgba(181, 212, 244, 0.4)',
    amber: 'rgba(250, 224, 168, 0.4)',
    teal:  'rgba(168, 230, 207, 0.4)',
    pink:  'rgba(244, 181, 204, 0.4)',
  };
  return map[colorKey] || map.blue;
}
