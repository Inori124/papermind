import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> | { paperId: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const paperId = resolvedParams.paperId;

    const db = getDb();
    const paper = db.prepare('SELECT filePath FROM papers WHERE id = ?').get(paperId) as any;

    if (!paper || !paper.filePath) {
      return new Response('PDF not found', { status: 404 });
    }

    const pdfPath = path.isAbsolute(paper.filePath)
      ? paper.filePath
      : path.join(process.cwd(), paper.filePath);

    if (!fs.existsSync(pdfPath)) {
      return new Response('PDF file missing', { status: 404 });
    }

    const buffer = fs.readFileSync(pdfPath);

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('PDF 服务错误:', error);
    return new Response('Internal error', { status: 500 });
  }
}
