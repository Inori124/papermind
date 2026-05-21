import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET — 获取高亮
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get('paperId');

  if (!paperId) {
    return Response.json({ error: 'paperId is required' }, { status: 400 });
  }

  const db = getDb();
  const highlights = db.prepare(
    'SELECT * FROM highlights WHERE paperId = ? ORDER BY createdAt ASC'
  ).all(paperId) as any[];

  // 转换为 react-pdf-highlighter-extended 的 Highlight 格式
  const formatted = highlights.map((h: any) => ({
    id: h.id,
    type: h.rects && JSON.parse(h.rects || '[]').length > 0 ? undefined : 'text',
    position: safeJsonParse(h.position || '{}', {}),
    content: { text: h.text || '' },
    comment: safeJsonParse(h.comment || '{"text":""}', { text: '' }),
    color: h.color || 'blue',
  }));

  return Response.json(formatted);
}

// POST — 创建高亮
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paperId, position, content, comment, color } = body;

    if (!paperId) {
      return Response.json({ error: 'paperId is required' }, { status: 400 });
    }

    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO highlights (id, paperId, paragraphId, text, color, position, comment, startOffset, endOffset, page, rects)
      VALUES (?, ?, '', ?, ?, ?, ?, 0, 0, ?, '[]')
    `).run(
      id,
      paperId,
      content?.text || '',
      color || 'blue',
      JSON.stringify(position || {}),
      JSON.stringify(comment || { text: '' }),
      position?.pageNumber || 0,
    );

    return Response.json({
      id,
      position: position || {},
      content: content || { text: '' },
      comment: comment || { text: '' },
      color: color || 'blue',
    }, { status: 201 });
  } catch (error) {
    console.error('创建高亮失败:', error);
    return Response.json({ error: '创建失败' }, { status: 500 });
  }
}

// PUT — 更新高亮（修改颜色、备注）
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, color, comment } = body;
    if (!id) return Response.json({ error: '缺少高亮 ID' }, { status: 400 });

    const db = getDb();
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (color !== undefined) { sets.push('color = ?'); vals.push(color); }
    if (comment !== undefined) { sets.push('comment = ?'); vals.push(JSON.stringify(comment)); }

    if (sets.length === 0) {
      return Response.json({ error: 'No fields to update' }, { status: 400 });
    }

    vals.push(id);
    db.prepare(`UPDATE highlights SET ${sets.join(', ')} WHERE id = ?`).run(...vals);

    const h = db.prepare('SELECT * FROM highlights WHERE id = ?').get(id) as any;
    return Response.json({
      id: h.id,
      position: safeJsonParse(h.position || '{}', {}),
      content: { text: h.text || '' },
      comment: safeJsonParse(h.comment || '{"text":""}', { text: '' }),
      color: h.color || 'blue',
    });
  } catch (error) {
    console.error('更新高亮失败:', error);
    return Response.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE — 删除高亮
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: '缺少 id' }, { status: 400 });

  const db = getDb();
  db.prepare('DELETE FROM highlights WHERE id = ?').run(id);
  return Response.json({ success: true });
}

function safeJsonParse(str: string, fallback: any) {
  try { return JSON.parse(str); } catch { return fallback; }
}
