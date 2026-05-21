import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { extractConcepts } from '@/lib/concept-extractor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paperId = searchParams.get('paperId');

    const db = getDb();

    if (paperId) {
      const concepts = db.prepare(
        "SELECT * FROM concepts WHERE paperIds LIKE ?"
      ).all(`%${paperId}%`);
      return NextResponse.json(concepts);
    }

    const concepts = db.prepare('SELECT * FROM concepts ORDER BY name').all();
    return NextResponse.json(concepts);
  } catch (error) {
    console.error('GET /api/concepts error:', error);
    return NextResponse.json({ error: 'Failed to fetch concepts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paperId } = body;

    if (!paperId) {
      return NextResponse.json({ error: 'paperId is required' }, { status: 400 });
    }

    const db = getDb();
    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as {
      title: string;
      abstract: string;
    } | undefined;

    if (!paper) {
      return NextResponse.json({ error: 'Paper not found' }, { status: 404 });
    }

    const paragraphs = db.prepare(
      'SELECT content FROM paragraphs WHERE paperId = ? ORDER BY idx ASC'
    ).all(paperId) as { content: string }[];

    const contents = paragraphs.map((p) => p.content);

    const result = await extractConcepts(paperId, paper.title, paper.abstract, contents);

    return NextResponse.json(result);
  } catch (error) {
    console.error('POST /api/concepts error:', error);
    return NextResponse.json({ error: 'Failed to extract concepts' }, { status: 500 });
  }
}
