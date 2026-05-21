import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const db = getDb();

    const paragraphs = db.prepare(
      'SELECT * FROM paragraphs WHERE paperId = ? ORDER BY idx ASC'
    ).all(paperId);

    return NextResponse.json(paragraphs);
  } catch (error) {
    console.error('GET /api/papers/[paperId]/paragraphs error:', error);
    return NextResponse.json({ error: 'Failed to fetch paragraphs' }, { status: 500 });
  }
}
