import { v4 as uuidv4 } from 'uuid';
import getDb from '@/lib/db';
import { chatCompletionJSON, generateEmbedding } from '@/lib/llm';
import { findSimilarConcepts } from '@/lib/vector';

const SYSTEM_PROMPT = `你是一个学术知识图谱构建专家。给定一篇学术论文的内容，你需要：

1. 提取 5-15 个核心概念（方法、理论、数据集、指标、发现、工具）
2. 识别概念之间的关系

返回 JSON 格式：
{
  "concepts": [
    {
      "name": "概念名称（英文优先，可附中文）",
      "category": "method|theory|dataset|metric|finding|tool",
      "description": "一句话描述"
    }
  ],
  "relations": [
    {
      "source": "概念A名称",
      "target": "概念B名称",
      "relationType": "builds_on|contradicts|applies|extends|compares|uses",
      "evidence": "论文中支持这个关系的原文摘录（一句话）"
    }
  ]
}

注意：
- 概念名称要标准化（如 "BERT" 而不是 "the BERT model"）
- 关系必须有论文原文作为证据
- 只提取论文中明确提到的概念和关系`;

interface ExtractedConcept {
  name: string;
  category: 'method' | 'theory' | 'dataset' | 'metric' | 'finding' | 'tool';
  description: string;
}

interface ExtractedRelation {
  source: string;
  target: string;
  relationType: 'builds_on' | 'contradicts' | 'applies' | 'extends' | 'compares' | 'uses';
  evidence: string;
}

interface ExtractionResult {
  concepts: ExtractedConcept[];
  relations: ExtractedRelation[];
}

function buildContentText(title: string, abstract: string, paragraphs: string[]): string {
  const parts = [`标题：${title}`, `摘要：${abstract}`];
  const bodyText = paragraphs.slice(0, 20).map((p, i) => `段落${i + 1}：${p}`).join('\n');
  parts.push(`正文（前20段）：${bodyText}`);
  return parts.join('\n\n').slice(0, 6000);
}

export async function extractConcepts(
  paperId: string,
  title: string,
  abstract: string,
  paragraphs: string[]
) {
  const db = getDb();
  const contentText = buildContentText(title, abstract, paragraphs);

  const result = await chatCompletionJSON<ExtractionResult>(
    SYSTEM_PROMPT,
    `请为以下论文提取概念和关系：\n\n${contentText}`,
    { temperature: 0.1, maxTokens: 4096 }
  );

  const conceptMap = new Map<string, string>(); // name -> id

  for (const c of result.concepts) {
    // Check if concept already exists across papers
    const existing = db.prepare('SELECT * FROM concepts WHERE name = ?').get(c.name) as {
      id: string;
      paperIds: string;
    } | undefined;

    let conceptId: string;

    if (existing) {
      conceptId = existing.id;
      const paperIds: string[] = JSON.parse(existing.paperIds);
      if (!paperIds.includes(paperId)) {
        paperIds.push(paperId);
        db.prepare('UPDATE concepts SET paperIds = ? WHERE id = ?').run(
          JSON.stringify(paperIds),
          conceptId
        );
      }
    } else {
      conceptId = uuidv4();
      db.prepare(`
        INSERT INTO concepts (id, name, category, description, paperId, paperIds, embedding)
        VALUES (?, ?, ?, ?, ?, ?, '[]')
      `).run(conceptId, c.name, c.category, c.description, paperId, JSON.stringify([paperId]));
    }

    conceptMap.set(c.name, conceptId);
  }

  for (const r of result.relations) {
    const sourceId = conceptMap.get(r.source);
    const targetId = conceptMap.get(r.target);

    if (!sourceId || !targetId) continue;

    const relationId = uuidv4();
    db.prepare(`
      INSERT INTO concept_relations (id, sourceId, targetId, relationType, strength, evidence, paperId)
      VALUES (?, ?, ?, ?, 0.5, ?, ?)
    `).run(relationId, sourceId, targetId, r.relationType, r.evidence, paperId);
  }

  // Generate embeddings for new concepts (background, non-blocking)
  for (const [name, conceptId] of conceptMap) {
    const concept = db.prepare('SELECT embedding FROM concepts WHERE id = ?').get(conceptId) as {
      embedding: string;
    };
    const emb = JSON.parse(concept.embedding);
    if (!emb || emb.length === 0) {
      try {
        const embedding = await generateEmbedding(name);
        db.prepare('UPDATE concepts SET embedding = ? WHERE id = ?').run(
          JSON.stringify(embedding),
          conceptId
        );
      } catch (e) {
        console.error(`Failed to generate embedding for "${name}":`, e);
      }
    }
  }

  // Cross-paper similarity linking
  const thisConceptIds = Array.from(conceptMap.values());
  const allConcepts = db.prepare('SELECT id, name, embedding FROM concepts').all() as {
    id: string;
    name: string;
    embedding: string;
  }[];

  const conceptsWithEmb = allConcepts
    .filter((c) => {
      const emb = JSON.parse(c.embedding);
      return emb && emb.length > 0;
    })
    .map((c) => ({
      id: c.id,
      name: c.name,
      embedding: JSON.parse(c.embedding) as number[],
    }));

  if (conceptsWithEmb.length > 1) {
    const linkedPairs = new Set<string>();

    for (const conceptId of thisConceptIds) {
      const concept = conceptsWithEmb.find((c) => c.id === conceptId);
      if (!concept) continue;

      const others = conceptsWithEmb.filter(
        (c) => c.id !== conceptId && !thisConceptIds.includes(c.id)
      );

      if (others.length === 0) continue;

      const similar = findSimilarConcepts(concept.embedding, others, 3);

      for (const s of similar) {
        if (s.similarity > 0.7) {
          const pairKey = [conceptId, s.id].sort().join('|');
          if (linkedPairs.has(pairKey)) continue;
          linkedPairs.add(pairKey);

          const existingRelation = db.prepare(
            `SELECT id FROM concept_relations
             WHERE (sourceId = ? AND targetId = ?) OR (sourceId = ? AND targetId = ?)`
          ).get(conceptId, s.id, s.id, conceptId);

          if (!existingRelation) {
            const relationId = uuidv4();
            db.prepare(`
              INSERT INTO concept_relations (id, sourceId, targetId, relationType, strength, evidence, paperId)
              VALUES (?, ?, ?, 'extends', ?, '', ?)
            `).run(
              relationId,
              conceptId,
              s.id,
              Math.round(s.similarity * 10) / 10,
              paperId
            );
          }
        }
      }
    }
  }

  return {
    concepts: result.concepts.length,
    relations: result.relations.length,
  };
}
