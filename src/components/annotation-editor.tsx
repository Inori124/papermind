'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { Annotation } from '@/types';

interface AnnotationEditorProps {
  paragraphId: string;
  paperId: string;
  existingAnnotation?: Annotation;
  onSaved: () => void;
}

const ANNOTATION_TYPES = [
  { value: 'note', label: '笔记' },
  { value: 'highlight', label: '高亮' },
  { value: 'question', label: '提问' },
] as const;

export default function AnnotationEditor({
  paragraphId,
  paperId,
  existingAnnotation,
  onSaved,
}: AnnotationEditorProps) {
  const [content, setContent] = useState(existingAnnotation?.content || '');
  const [type, setType] = useState<'note' | 'highlight' | 'question'>(
    (existingAnnotation?.type as 'note' | 'highlight' | 'question') || 'note'
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;

    setSaving(true);
    try {
      const res = await fetch('/api/annotate', {
        method: existingAnnotation ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          existingAnnotation
            ? { id: existingAnnotation.id, content }
            : { paragraphId, paperId, content, type }
        ),
      });

      if (!res.ok) throw new Error('Failed to save');

      toast.success('批注已保存');
      onSaved();
    } catch {
      toast.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-3 border-t border-border">
      <div className="flex items-center gap-1.5 mb-2">
        {ANNOTATION_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setType(t.value)}
            className="text-[10px]"
          >
            <Badge variant={type === t.value ? 'default' : 'outline'} className="cursor-pointer h-5">
              {t.label}
            </Badge>
          </button>
        ))}
      </div>

      <Textarea
        placeholder="写点批注..."
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={3}
        className="text-xs resize-none mb-2"
      />

      <Button
        size="sm"
        className="h-7 text-xs w-full"
        onClick={handleSave}
        disabled={!content.trim() || saving}
      >
        {saving ? '保存中...' : '保存批注'}
      </Button>
    </div>
  );
}
