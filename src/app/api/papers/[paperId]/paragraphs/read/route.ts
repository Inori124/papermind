import { NextRequest } from 'next/server';
import getDb from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const { paragraphId } = await request.json();
    const db = getDb();

    db.prepare(
      'UPDATE paragraphs SET isRead = 1 WHERE id = ? AND paperId = ?'
    ).run(paragraphId, paperId);

    const total = db.prepare(
      'SELECT COUNT(*) as count FROM paragraphs WHERE paperId = ?'
    ).get(paperId) as any;

    const read = db.prepare(
      'SELECT COUNT(*) as count FROM paragraphs WHERE paperId = ? AND isRead = 1'
    ).get(paperId) as any;

    const progress = total.count > 0
      ? Math.round((read.count / total.count) * 100)
      : 0;

    db.prepare(
      "UPDATE papers SET readProgress = ?, updatedAt = datetime('now') WHERE id = ?"
    ).run(progress, paperId);

    return Response.json({
      readCount: read.count,
      totalCount: total.count,
      progress,
    });
  } catch (error) {
    console.error('标记已读失败:', error);
    return Response.json({ error: '更新失败' }, { status: 500 });
  }
}
