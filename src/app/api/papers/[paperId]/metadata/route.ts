import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import { fetchJournalMetadata } from '@/lib/journal-metadata';
import fs from 'fs';
import pdf from 'pdf-parse';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ paperId: string }> }
) {
  try {
    const { paperId } = await params;
    const db = getDb();

    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return Response.json({ error: '论文不存在' }, { status: 404 });
    }

    let pdfText = '';
    if (paper.filePath && fs.existsSync(paper.filePath)) {
      const buffer = fs.readFileSync(paper.filePath);
      const data = await pdf(buffer);
      pdfText = data.text;
    }

    if (!pdfText) {
      return Response.json({ error: '无法读取 PDF 文本' }, { status: 400 });
    }

    const metadata = await fetchJournalMetadata(pdfText);

    if (metadata.doi || metadata.journal) {
      db.prepare(`
        UPDATE papers
        SET doi = ?, journal = ?, issn = ?, publishYear = ?,
            impactFactor = ?, hIndex = ?, jcrQuartile = ?,
            citationCount = ?, openAccessStatus = ?,
            updatedAt = datetime('now')
        WHERE id = ?
      `).run(
        metadata.doi, metadata.journal, metadata.issn,
        metadata.publishYear, metadata.impactFactor, metadata.hIndex,
        metadata.jcrQuartile, metadata.citationCount, metadata.openAccessStatus,
        paperId
      );
    }

    return Response.json(metadata);
  } catch (error) {
    console.error('元数据获取失败:', error);
    return Response.json({ error: '获取失败' }, { status: 500 });
  }
}
