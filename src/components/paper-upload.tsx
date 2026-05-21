'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaperUploadProps {
  onUploaded: () => void;
}

export default function PaperUpload({ onUploaded }: PaperUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  const handleUpload = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        toast.error('只支持 PDF 文件');
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error('文件大小不能超过 50MB');
        return;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/papers', {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '上传失败');
        }

        const paper = await res.json();
        toast.success(`上传成功：${paper.title}`);
        onUploaded();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '上传失败，请重试');
      } finally {
        setUploading(false);
      }
    },
    [onUploaded]
  );

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.items?.[0]?.kind === 'file') {
      setDragging(true);
    }
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDragging(false);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      dragCounter.current = 0;

      const file = e.dataTransfer.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [handleUpload]
  );

  return (
    <div
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => fileInputRef.current?.click()}
      className={
        uploading
          ? 'border border-dashed border-border rounded-xl flex flex-col items-center justify-center py-12 px-6 opacity-60 pointer-events-none'
          : dragging
            ? 'border-2 border-dashed border-blue-300 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 flex flex-col items-center justify-center py-12 px-6 cursor-pointer'
            : 'border border-dashed border-border rounded-xl flex flex-col items-center justify-center py-12 px-6 transition-colors duration-200 cursor-pointer hover:border-foreground/20 hover:bg-foreground/[0.02]'
      }
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={onFileSelect}
      />

      {uploading ? (
        <>
          <Loader2 size={28} className="animate-spin text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">正在解析论文...</p>
        </>
      ) : dragging ? (
        <>
          <Upload size={28} strokeWidth={1.2} className="text-blue-400 mb-3" />
          <p className="text-sm text-blue-600 dark:text-blue-400">释放以上传</p>
        </>
      ) : (
        <>
          <Upload size={28} strokeWidth={1.2} className="text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">拖拽 PDF 到此处上传</p>
          <p className="text-xs text-muted-foreground/60 mt-1">或点击选择文件 · 最大 50MB</p>
        </>
      )}
    </div>
  );
}
