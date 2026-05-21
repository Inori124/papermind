import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/llm';
import getDb from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { paperId } = await request.json();
    if (!paperId) {
      return Response.json({ error: 'paperId is required' }, { status: 400 });
    }

    const db = getDb();

    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId) as any;
    if (!paper) {
      return Response.json({ error: '论文不存在' }, { status: 404 });
    }

    const annotations = db.prepare(
      `SELECT a.*, p.content as paragraphContent, p.section
       FROM annotations a LEFT JOIN paragraphs p ON a.paragraphId = p.id
       WHERE a.paperId = ? ORDER BY p.idx ASC`
    ).all(paperId) as any[];

    const highlights = db.prepare(
      `SELECT h.*, p.section
       FROM highlights h LEFT JOIN paragraphs p ON h.paragraphId = p.id
       WHERE h.paperId = ? AND h.note != '' ORDER BY p.idx ASC`
    ).all(paperId) as any[];

    const concepts = db.prepare(
      "SELECT * FROM concepts WHERE paperIds LIKE ?"
    ).all(`%${paperId}%`) as any[];

    const materials: string[] = [];
    materials.push(`论文标题：${paper.title}`);
    materials.push(`作者：${paper.authors}`);
    materials.push(`摘要：${paper.abstract}`);

    if (concepts.length > 0) {
      materials.push(`\n核心概念：${concepts.map((c: any) => `${c.name}（${c.description}）`).join('；')}`);
    }

    if (annotations.length > 0) {
      materials.push('\n用户笔记：');
      annotations.forEach((a: any, i: number) => {
        materials.push(`${i + 1}. [${a.section || '未知章节'}] ${a.content}`);
        if (a.aiExplanation) {
          materials.push(`   AI 解释：${a.aiExplanation.slice(0, 200)}`);
        }
      });
    }

    if (highlights.length > 0) {
      materials.push('\n用户高亮备注：');
      highlights.forEach((h: any) => {
        materials.push(`- 高亮 "${h.text.slice(0, 50)}..."：${h.note}`);
      });
    }

    const systemPrompt = `你是一位学术助手，帮助研究生复习论文。根据下面提供的论文信息、用户笔记、AI 解释和高亮备注，生成一段简明的复习笔记。

要求：
1. 用中文撰写，语言简洁清晰
2. 结构分为：研究背景（1-2 句）→ 核心方法（1-2 句）→ 关键发现（2-3 句）→ 用户关注点（根据笔记和高亮总结用户特别关注的内容）
3. 总长度控制在 300-500 字
4. 特别突出用户自己做的笔记和标注中提到的要点
5. 不要使用 Markdown 格式标记，用纯文本，段落之间用空行分隔`;

    const summary = await chatCompletion(
      systemPrompt,
      materials.join('\n'),
      { temperature: 0.3, maxTokens: 1024 }
    );

    // Persist to papers.reviewNote
    try {
      db.prepare("ALTER TABLE papers ADD COLUMN reviewNote TEXT DEFAULT ''").run();
    } catch { /* column already exists */ }

    db.prepare('UPDATE papers SET reviewNote = ? WHERE id = ?').run(summary, paperId);

    return Response.json({ summary });
  } catch (error) {
    console.error('生成复习笔记失败:', error);
    return Response.json({ error: '生成失败，请重试' }, { status: 500 });
  }
}
