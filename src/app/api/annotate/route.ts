import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import getDb from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paperId = searchParams.get('paperId');
    const paragraphId = searchParams.get('paragraphId');

    if (!paperId) {
      return NextResponse.json({ error: 'paperId query parameter is required' }, { status: 400 });
    }

    const db = getDb();

    let annotations;
    if (paragraphId) {
      annotations = db.prepare(
        'SELECT * FROM annotations WHERE paperId = ? AND paragraphId = ? ORDER BY createdAt DESC'
      ).all(paperId, paragraphId);
    } else {
      annotations = db.prepare(
        'SELECT * FROM annotations WHERE paperId = ? ORDER BY createdAt DESC'
      ).all(paperId);
    }

    return NextResponse.json(annotations);
  } catch (error) {
    console.error('GET /api/annotate error:', error);
    return NextResponse.json({ error: 'Failed to fetch annotations' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paragraphId, paperId, content, type } = body;

    if (!paragraphId || !paperId) {
      return NextResponse.json(
        { error: 'paragraphId and paperId are required' },
        { status: 400 }
      );
    }

    const db = getDb();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO annotations (id, paragraphId, paperId, content, type)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, paragraphId, paperId, content || '', type || 'note');

    const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);

    return NextResponse.json(annotation, { status: 201 });
  } catch (error) {
    console.error('POST /api/annotate error:', error);
    return NextResponse.json({ error: 'Failed to create annotation' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, content } = body;

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const db = getDb();

    const existing = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    db.prepare('UPDATE annotations SET content = ? WHERE id = ?').run(content ?? '', id);

    const updated = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('PUT /api/annotate error:', error);
    return NextResponse.json({ error: 'Failed to update annotation' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const db = getDb();
    const existing = db.prepare('SELECT * FROM annotations WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM annotations WHERE id = ?').run(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/annotate error:', error);
    return NextResponse.json({ error: 'Failed to delete annotation' }, { status: 500 });
  }
}
