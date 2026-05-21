'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Paper } from '@/types';

interface PaperEditDialogProps {
  paper: Paper;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Record<string, unknown>) => Promise<void>;
}

const JCR_OPTIONS = ['', 'Q1', 'Q2', 'Q3', 'Q4'] as const;

export default function PaperEditDialog({ paper, open, onOpenChange, onSave }: PaperEditDialogProps) {
  const [year, setYear] = useState(paper.year?.toString() ?? '');
  const [journal, setJournal] = useState(paper.journal ?? '');
  const [impactFactor, setImpactFactor] = useState(paper.impactFactor?.toString() ?? '');
  const [jcrQuartile, setJcrQuartile] = useState(paper.jcrQuartile ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(paper.id, {
        year: year ? parseInt(year, 10) : null,
        journal,
        impactFactor: impactFactor ? parseFloat(impactFactor) : null,
        jcrQuartile: jcrQuartile || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      if (!open) {
        setYear(paper.year?.toString() ?? '');
        setJournal(paper.journal ?? '');
        setImpactFactor(paper.impactFactor?.toString() ?? '');
        setJcrQuartile(paper.jcrQuartile ?? '');
      }
      onOpenChange(open);
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>编辑元数据</DialogTitle>
          <DialogDescription className="line-clamp-1">{paper.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">发表年份</label>
            <Input
              type="number"
              placeholder="如 2024"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              min={1900}
              max={2030}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">期刊名称</label>
            <Input
              placeholder="如 Nature"
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">影响因子 (IF)</label>
            <Input
              type="number"
              placeholder="如 6.5"
              value={impactFactor}
              onChange={(e) => setImpactFactor(e.target.value)}
              min={0}
              step={0.1}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">JCR 分区</label>
            <div className="flex gap-1.5">
              {JCR_OPTIONS.map((q) => (
                <Button
                  key={q || 'none'}
                  variant={jcrQuartile === q ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => setJcrQuartile(q)}
                >
                  {q || '无'}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>取消</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
