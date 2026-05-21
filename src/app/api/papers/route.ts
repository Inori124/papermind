import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import getDb from '@/lib/db';
import { parsePDF } from '@/lib/pdf-parser';
import pdf from 'pdf-parse';

export async function GET() {
  try {
    const db = getDb();
    const papers = db.prepare(
      `SELECT p.*, c.name as categoryName
       FROM papers p
       LEFT JOIN categories c ON p.categoryId = c.id
       ORDER BY p.updatedAt DESC`
    ).all() as any[];
    const conceptCounts = db.prepare('SELECT paperIds FROM concepts').all() as any[];

    // 为每篇论文计算关联概念数
    const countMap: Record<string, number> = {};
    for (const row of conceptCounts) {
      const ids: string[] = JSON.parse(row.paperIds || '[]');
      for (const id of ids) {
        countMap[id] = (countMap[id] || 0) + 1;
      }
    }

    const papersWithCount = papers.map((p) => ({
      ...p,
      conceptCount: countMap[p.id] || 0,
    }));

    return NextResponse.json(papersWithCount);
  } catch (error) {
    console.error('GET /api/papers error:', error);
    return NextResponse.json({ error: 'Failed to fetch papers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json({ error: 'Only PDF files are accepted' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const paperId = uuidv4();
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const filePath = path.join(uploadDir, `${paperId}.pdf`);
    fs.writeFileSync(filePath, buffer);

    const parsed = await parsePDF(buffer);

    const db = getDb();

    const insertAll = db.transaction(() => {
      db.prepare(`
        INSERT INTO papers (id, title, authors, abstract, filePath, totalParagraphs, year, journal, impactFactor, jcrQuartile)
        VALUES (?, ?, ?, ?, ?, ?, ?, '', NULL, NULL)
      `).run(paperId, parsed.title, parsed.authors, parsed.abstract, filePath, parsed.paragraphs.length, parsed.year);

      const insertParagraph = db.prepare(`
        INSERT INTO paragraphs (id, paperId, idx, content, section, pageNumber)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const p of parsed.paragraphs) {
        insertParagraph.run(p.id, paperId, p.index, p.content, p.section, p.pageNumber);
      }
    });

    insertAll();

    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);

    // 异步触发概念提取（不阻塞响应）
    (async () => {
      try {
        console.log(`[概念提取] 开始提取论文 ${paperId} 的概念...`);
        const { extractConcepts } = await import('@/lib/concept-extractor');
        await extractConcepts(
          paperId,
          parsed.title,
          parsed.abstract,
          parsed.paragraphs.map((p) => p.content)
        );
        console.log(`[概念提取] 论文 ${paperId} 概念提取完成`);
      } catch (error) {
        console.error(`[概念提取] 论文 ${paperId} 提取失败:`, error);
      }
    })();

    // 异步获取期刊元数据（不阻塞响应）
    (async () => {
      try {
        console.log(`[元数据] 开始获取论文 ${paperId} 的期刊信息...`);
        const pdfData = await pdf(buffer);
        const { fetchJournalMetadata } = await import('@/lib/journal-metadata');
        const metadata = await fetchJournalMetadata(pdfData.text);

        if (metadata.doi || metadata.journal) {
          const db = getDb();
          db.prepare(`
            UPDATE papers
            SET doi = ?, journal = ?, issn = ?, publishYear = ?,
                impactFactor = ?, hIndex = ?, jcrQuartile = ?,
                citationCount = ?, openAccessStatus = ?,
                updatedAt = datetime('now')
            WHERE id = ?
          `).run(
            metadata.doi,
            metadata.journal,
            metadata.issn,
            metadata.publishYear,
            metadata.impactFactor,
            metadata.hIndex,
            metadata.jcrQuartile,
            metadata.citationCount,
            metadata.openAccessStatus,
            paperId
          );

          console.log(`[元数据] 论文 ${paperId} 元数据已更新: ${metadata.journal} IF=${metadata.impactFactor}`);
        }
      } catch (error) {
        console.error(`[元数据] 论文 ${paperId} 获取失败:`, error);
      }
    })();

    return NextResponse.json(paper, { status: 201 });
  } catch (error) {
    console.error('POST /api/papers error:', error);
    return NextResponse.json({ error: 'Failed to upload paper' }, { status: 500 });
  }
}
