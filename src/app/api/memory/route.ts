import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { generatePeriodicSummary } from '@/lib/chat-memory';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const paperId = searchParams.get('paperId');
  const type = searchParams.get('type');
  const latest = searchParams.get('latest');

  if (!paperId) {
    return Response.json({ error: 'paperId required' }, { status: 400 });
  }

  const db = getDb();

  if (latest && type) {
    const entry = db.prepare(
      'SELECT * FROM chat_memory WHERE paperId = ? AND type = ? ORDER BY createdAt DESC LIMIT 1'
    ).get(paperId, type);
    return Response.json(entry || {});
  }

  let query = 'SELECT * FROM chat_memory WHERE paperId = ?';
  const params: unknown[] = [paperId];

  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY createdAt ASC';

  const entries = db.prepare(query).all(...params);
  return Response.json(entries);
}

export async function POST(request: NextRequest) {
  try {
    const { paperId, readCount } = await request.json();
    if (!paperId) {
      return Response.json({ error: 'paperId required' }, { status: 400 });
    }
    await generatePeriodicSummary(paperId, readCount || 0);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Failed' }, { status: 500 });
  }
}
