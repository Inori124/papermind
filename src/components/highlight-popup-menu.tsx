'use client';

import { useState, useCallback } from 'react';
import { Trash2, Palette, StickyNote } from 'lucide-react';
import type { TipViewerUtils } from 'react-pdf-highlighter-extended/dist/esm/contexts/TipContext';

const HIGHLIGHT_COLORS = [
  { key: 'blue',  label: '概念', color: '#B5D4F4' },
  { key: 'amber', label: '发现', color: '#FAE0A8' },
  { key: 'teal',  label: '方法', color: '#A8E6CF' },
  { key: 'pink',  label: '疑问', color: '#F4B5CC' },
];

interface HighlightPopupMenuProps {
  highlightId: string;
  currentColor: string;
  currentNote: string;
  tipUtils: TipViewerUtils | null;
  onDelete: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onSaveNote: (id: string, note: string) => void;
  onClose: () => void;
}

export default function HighlightPopupMenu({
  highlightId,
  currentColor,
  currentNote,
  tipUtils,
  onDelete,
  onChangeColor,
  onSaveNote,
  onClose,
}: HighlightPopupMenuProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState(currentNote || '');

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onDelete(highlightId);
    tipUtils?.setTip(null);
    onClose();
  }, [highlightId, onDelete, tipUtils, onClose]);

  const handleColorSelect = useCallback((e: React.MouseEvent, color: string) => {
    e.stopPropagation();
    e.preventDefault();
    onChangeColor(highlightId, color);
    setShowColorPicker(false);
  }, [highlightId, onChangeColor]);

  const handleSaveNote = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSaveNote(highlightId, noteText);
    setShowNoteInput(false);
  }, [highlightId, noteText, onSaveNote]);

  const handleNoteInputMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-2 min-w-[180px]">
      {/* Action buttons row */}
      <div className="flex items-center gap-1">
        {/* Color change button */}
        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
          title="更改颜色"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowColorPicker(!showColorPicker);
            setShowNoteInput(false);
          }}
        >
          <Palette className="size-3.5 text-muted-foreground" />
        </button>

        {/* Note button */}
        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
          title="添加笔记"
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowNoteInput(!showNoteInput);
            setShowColorPicker(false);
            if (!showNoteInput) setNoteText(currentNote || '');
          }}
        >
          <StickyNote className="size-3.5 text-muted-foreground" />
        </button>

        {/* Delete button */}
        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          title="删除高亮"
          onMouseDown={handleDelete}
        >
          <Trash2 className="size-3.5 text-red-500" />
        </button>
      </div>

      {/* Current color indicator */}
      <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border">
        {HIGHLIGHT_COLORS.map((c) => (
          <button
            key={c.key}
            className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
              currentColor === c.key ? 'border-foreground scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c.color }}
            title={c.label}
            onMouseDown={(e) => handleColorSelect(e, c.key)}
          />
        ))}
      </div>

      {/* Color picker expanded */}
      {showColorPicker && (
        <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-border">
          {HIGHLIGHT_COLORS.map((c) => (
            <button
              key={`picker-${c.key}`}
              className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                currentColor === c.key ? 'border-foreground scale-110' : 'border-transparent'
              }`}
              style={{ backgroundColor: c.color }}
              title={c.label}
              onMouseDown={(e) => handleColorSelect(e, c.key)}
            />
          ))}
        </div>
      )}

      {/* Note input */}
      {showNoteInput && (
        <div className="mt-1.5 pt-1.5 border-t border-border" onMouseDown={handleNoteInputMouseDown}>
          <textarea
            className="w-full text-xs border border-border rounded-md p-1.5 bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            rows={2}
            placeholder="添加笔记..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.stopPropagation();
                onSaveNote(highlightId, noteText);
                setShowNoteInput(false);
              }
            }}
          />
          <div className="flex items-center justify-between mt-1">
            <span className="text-[10px] text-muted-foreground">Cmd+Enter 保存</span>
            <button
              className="h-6 px-2 text-[11px] bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
              onMouseDown={handleSaveNote}
            >
              保存
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
