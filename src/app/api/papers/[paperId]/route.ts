import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const db = getDb();
    const paper = db.prepare(
      `SELECT p.*, c.name as categoryName
       FROM papers p
       LEFT JOIN categories c ON p.categoryId = c.id
       WHERE p.id = ?`
    ).get(paperId);

    if (!paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    return NextResponse.json(paper);
  } catch (error) {
    console.error('GET /api/papers/[paperId] error:', error);
    return NextResponse.json({ error: 'Failed to fetch paper' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const db = getDb();

    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as { filePath: string } | undefined;
    if (!paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    // Delete from database (cascades to paragraphs, annotations, concepts, relations)
    db.prepare('DELETE FROM papers WHERE id = ?').run(paperId);

    // Delete PDF file
    if (fs.existsSync(paper.filePath)) {
      fs.unlinkSync(paper.filePath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/papers/[paperId] error:', error);
    return NextResponse.json({ error: 'Failed to delete paper' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const body = await request.json();
    const db = getDb();

    const existing = db.prepare('SELECT id FROM papers WHERE id = ?').get(paperId);
    if (!existing) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    const allowedText = ['title', 'authors', 'abstract', 'journal'] as const;
    const allowedNum = ['year', 'impactFactor'] as const;

    const sets: string[] = [];
    const values: unknown[] = [];

    for (const key of allowedText) {
      if (key in body) {
        sets.push(`${key} = ?`);
        values.push(String(body[key] ?? ''));
      }
    }

    for (const key of allowedNum) {
      if (key in body) {
        const val = body[key];
        if (val !== null && val !== undefined && (typeof val !== 'number' || isNaN(val))) {
          return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
        }
        sets.push(`${key} = ?`);
        values.push(val ?? null);
      }
    }

    if ('jcrQuartile' in body) {
      const q = body.jcrQuartile;
      if (q !== null && typeof q !== 'string') {
        return NextResponse.json({ error: 'Invalid jcrQuartile' }, { status: 400 });
      }
      sets.push('jcrQuartile = ?');
      values.push(q ?? null);
    }

    if ('categoryId' in body) {
      sets.push('categoryId = ?');
      values.push(String(body.categoryId || ''));
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    sets.push("updatedAt = datetime('now')");
    values.push(paperId);

    db.prepare(`UPDATE papers SET ${sets.join(', ')} WHERE id = ?`).run(...values);

    const updated = db.prepare(
      `SELECT p.*, c.name as categoryName
       FROM papers p
       LEFT JOIN categories c ON p.categoryId = c.id
       WHERE p.id = ?`
    ).get(paperId);
    return NextResponse.json(updated);
  } catch (error) {
    console.error('PATCH /api/papers/[paperId] error:', error);
    return NextResponse.json({ error: 'Failed to update paper' }, { status: 500 });
  }
}
