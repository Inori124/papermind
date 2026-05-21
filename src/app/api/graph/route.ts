import { NextRequest } from 'next/server';
import getDb from '@/lib/db';
import type { GraphData, GraphNode, GraphLink } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterPaperId = searchParams.get('paperId');

    const db = getDb();

    let concepts: any[];
    if (filterPaperId) {
      concepts = db.prepare(
        "SELECT * FROM concepts WHERE paperIds LIKE ?"
      ).all(`%${filterPaperId}%`);
    } else {
      concepts = db.prepare('SELECT * FROM concepts').all();
    }

    // Build nodes with paper title details
    const nodes: GraphNode[] = concepts.map((c: any) => {
      const paperIds: string[] = JSON.parse(c.paperIds || '[]');

      const papers = paperIds
        .map((pid: string) => {
          const paper = db.prepare('SELECT id, title FROM papers WHERE id = ?').get(pid) as any;
          return paper ? { id: paper.id, title: paper.title } : null;
        })
        .filter(Boolean) as { id: string; title: string }[];

      return {
        id: c.id,
        name: c.name,
        category: c.category,
        description: c.description,
        paperCount: papers.length,
        papers,
        val: Math.max(papers.length * 3, 4),
      };
    });

    // Get relations
    let relations: any[];
    if (filterPaperId) {
      const conceptIds = concepts.map((c: any) => c.id);
      if (conceptIds.length === 0) {
        return Response.json({ nodes: [], links: [] } as GraphData);
      }
      const placeholders = conceptIds.map(() => '?').join(',');
      relations = db.prepare(
        `SELECT * FROM concept_relations WHERE sourceId IN (${placeholders}) OR targetId IN (${placeholders})`
      ).all(...conceptIds);
    } else {
      relations = db.prepare('SELECT * FROM concept_relations').all();
    }

    const links: GraphLink[] = relations.map((r: any) => ({
      source: r.sourceId,
      target: r.targetId,
      relationType: r.relationType,
      strength: r.strength,
      evidence: r.evidence,
    }));

    return Response.json({ nodes, links } as GraphData);
  } catch (error) {
    console.error('获取图谱数据失败:', error);
    return Response.json({ error: '获取失败' }, { status: 500 });
  }
}
