'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open, title, description, confirmLabel = '确认删除', onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/20 animate-fade-in-fast" onClick={onCancel} />
      <div className="relative bg-background border border-border rounded-xl p-5 w-[340px] shadow-lg animate-scale-in">
        <h3 className="text-sm font-semibold mb-1.5">{title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{description}</p>
        <div className="flex justify-end gap-2">
          <button
            className="text-xs px-3 py-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
            onClick={onCancel}
          >
            取消
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
