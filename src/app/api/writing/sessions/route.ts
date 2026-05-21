import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// GET /api/writing/sessions — list all sessions ordered by most recently updated
export async function GET() {
  try {
    const db = getDb();
    const sessions = db.prepare(
      'SELECT * FROM writing_sessions ORDER BY updatedAt DESC'
    ).all();
    return Response.json(sessions);
  } catch (error) {
    return Response.json({ error: '获取失败' }, { status: 500 });
  }
}

// POST /api/writing/sessions — create a new session
export async function POST(request: NextRequest) {
  try {
    const { prompt, style, language, content } = await request.json();
    const db = getDb();

    const id = uuidv4();
    const title = prompt ? (prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '')) : '未命名';

    db.prepare(
      'INSERT INTO writing_sessions (id, title, prompt, style, language, content) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, title, prompt || '', style || 'academic', language || 'zh', content || '');

    const session = db.prepare('SELECT * FROM writing_sessions WHERE id = ?').get(id);
    return Response.json(session);
  } catch (error) {
    return Response.json({ error: '创建失败' }, { status: 500 });
  }
}

// PUT /api/writing/sessions — update an existing session
export async function PUT(request: NextRequest) {
  try {
    const { id, content, prompt, style, language } = await request.json();
    if (!id) {
      return Response.json({ error: '缺少 id' }, { status: 400 });
    }

    const db = getDb();

    if (content !== undefined) {
      db.prepare(
        "UPDATE writing_sessions SET content = ?, updatedAt = datetime('now') WHERE id = ?"
      ).run(content, id);
    }
    if (prompt !== undefined) {
      const title = prompt.slice(0, 30) + (prompt.length > 30 ? '...' : '');
      db.prepare(
        "UPDATE writing_sessions SET prompt = ?, title = ?, updatedAt = datetime('now') WHERE id = ?"
      ).run(prompt, title, id);
    }
    if (style !== undefined) {
      db.prepare('UPDATE writing_sessions SET style = ? WHERE id = ?').run(style, id);
    }
    if (language !== undefined) {
      db.prepare('UPDATE writing_sessions SET language = ? WHERE id = ?').run(language, id);
    }

    const session = db.prepare('SELECT * FROM writing_sessions WHERE id = ?').get(id);
    return Response.json(session);
  } catch (error) {
    return Response.json({ error: '更新失败' }, { status: 500 });
  }
}

// DELETE /api/writing/sessions — delete a session
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return Response.json({ error: '缺少 id' }, { status: 400 });

    const db = getDb();
    db.prepare('DELETE FROM writing_sessions WHERE id = ?').run(id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: '删除失败' }, { status: 500 });
  }
}
