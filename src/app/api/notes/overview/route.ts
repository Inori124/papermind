import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    const papers = db.prepare('SELECT * FROM papers ORDER BY updatedAt DESC').all() as any[];

    const overview = papers.map((paper: any) => {
      const totalParagraphs = db.prepare(
        'SELECT COUNT(*) as count FROM paragraphs WHERE paperId = ?'
      ).get(paper.id) as any;

      const readParagraphs = db.prepare(
        'SELECT COUNT(*) as count FROM paragraphs WHERE paperId = ? AND isRead = 1'
      ).get(paper.id) as any;

      const annotationCount = db.prepare(
        'SELECT COUNT(*) as count FROM annotations WHERE paperId = ?'
      ).get(paper.id) as any;

      let highlightCount = { count: 0 };
      try {
        highlightCount = db.prepare(
          'SELECT COUNT(*) as count FROM highlights WHERE paperId = ?'
        ).get(paper.id) as any;
      } catch { /* highlights table may not exist */ }

      // Only paragraphs that have notes or highlights
      const paragraphNotes = db.prepare(`
        SELECT
          p.id as paragraphId,
          p.content as paragraphContent,
          p.section,
          p.idx
        FROM paragraphs p
        WHERE p.paperId = ?
        AND (
          EXISTS (SELECT 1 FROM annotations a WHERE a.paragraphId = p.id)
          OR EXISTS (SELECT 1 FROM highlights h WHERE h.paragraphId = p.id)
        )
        ORDER BY p.idx ASC
      `).all(paper.id) as any[];

      const enrichedNotes = paragraphNotes.map((pn: any) => {
        const annotations = db.prepare(
          'SELECT * FROM annotations WHERE paragraphId = ? ORDER BY createdAt ASC'
        ).all(pn.paragraphId);

        let highlights: any[] = [];
        try {
          highlights = db.prepare(
            'SELECT * FROM highlights WHERE paragraphId = ? ORDER BY startOffset ASC'
          ).all(pn.paragraphId) as any[];
        } catch { /* highlights table may not exist */ }

        return {
          ...pn,
          paragraphPreview:
            pn.paragraphContent.slice(0, 80) +
            (pn.paragraphContent.length > 80 ? '...' : ''),
          annotations,
          highlights,
        };
      });

      return {
        id: paper.id,
        title: paper.title,
        authors: paper.authors,
        totalParagraphs: totalParagraphs.count,
        readParagraphs: readParagraphs.count,
        readProgress: totalParagraphs.count > 0
          ? Math.round((readParagraphs.count / totalParagraphs.count) * 100)
          : 0,
        annotationCount: annotationCount.count,
        highlightCount: highlightCount.count,
        reviewNote: paper.reviewNote || '',
        paragraphNotes: enrichedNotes,
      };
    });

    return Response.json(overview);
  } catch (error) {
    console.error('获取笔记概览失败:', error);
    return Response.json({ error: '获取失败' }, { status: 500 });
  }
}
