import { NextRequest } from 'next/server';
import { chatCompletion } from '@/lib/llm';
import getDb from '@/lib/db';

const styleGuide: Record<string, string> = {
  academic: '标准的学术论文风格，使用第三人称、被动语态，保持严谨客观。结构清晰，逻辑严密，引用规范。',
  'literature-review': '文献综述风格，综合多篇文献的观点，指出研究之间的共识与分歧，总结研究趋势与空白。',
  summary: '简明摘要风格，用简洁的语言概括核心观点，突出关键发现与结论。',
  critical: '批判性分析风格，不仅介绍已有研究，还要分析其方法论的优劣、结论的可靠性，提出独立的批判性见解。',
};

export async function POST(request: NextRequest) {
  try {
    const { topic, style, language } = await request.json();

    if (!topic) {
      return Response.json({ error: '请提供写作主题' }, { status: 400 });
    }

    const db = getDb();

    const papers = db.prepare('SELECT * FROM papers ORDER BY updatedAt DESC').all() as any[];

    // Build corpus: one entry per paper with clear ID labeling
    const paperInfos = papers.map((p) => {
      const parts: string[] = [];
      parts.push(`标题：${p.title}`);
      if (p.authors) parts.push(`作者：${p.authors}`);
      if (p.journal) parts.push(`期刊：${p.journal}${p.publishYear ? ` (${p.publishYear})` : ''}`);
      if (p.abstract) parts.push(`摘要：${p.abstract.slice(0, 300)}`);

      const concepts = db.prepare(
        "SELECT * FROM concepts WHERE paperIds LIKE ?"
      ).all(`%${p.id}%`) as any[];
      if (concepts.length > 0) {
        parts.push(`核心概念：${concepts.map((c: any) => `${c.name}（${c.category}: ${c.description}）`).join('；')}`);
      }

      const annotations = db.prepare(
        `SELECT a.*, p2.content as paragraphContent, p2.section
         FROM annotations a LEFT JOIN paragraphs p2 ON a.paragraphId = p2.id
         WHERE a.paperId = ? ORDER BY p2.idx ASC`
      ).all(p.id) as any[];
      if (annotations.length > 0) {
        parts.push(`用户笔记：${annotations.map((a: any) => `[${a.section || '未知'}] ${a.content}`).join('；')}`);
      }

      const highlights = db.prepare(
        "SELECT * FROM highlights WHERE paperId = ? AND note != '' ORDER BY createdAt ASC"
      ).all(p.id) as any[];
      if (highlights.length > 0) {
        parts.push(`用户高亮备注：${highlights.map((h: any) => `"${h.text.slice(0, 80)}" — ${h.note}`).join('；')}`);
      }

      return `[论文ID: ${p.id}] ${parts.join('\n')}`;
    });

    const corpusText = paperInfos.join('\n\n');

    const languageGuide = language === 'en' ? '用英文撰写' : '用中文撰写（学术术语可以保留英文）';

    const systemPrompt = `你是一位学术写作助手。用户会给你一个写作主题，你直接输出一段完整的学术文本。

写作规则：
1. ${languageGuide}
2. ${styleGuide[style] || styleGuide['academic']}
3. 直接输出正文内容，不要有任何开头说明（不要写"以下是..."、"基于..."、"根据..."等引导语）
4. 不要有分隔线、标题行、元说明
5. 引用格式使用 [1] [2] [3] 这样的数字序号标注在文中
6. 在正文末尾用空行隔开，列出参考文献列表，格式为：
   [1] 作者 (年份). 标题. 期刊. {{paperId:论文ID}}
   [2] 作者 (年份). 标题. 期刊. {{paperId:论文ID}}
   每条参考文献末尾必须附上 {{paperId:对应论文的ID}}，这个标记用于前端生成跳转链接
7. 只引用下面语料库中实际存在的论文，不要编造不存在的文献
8. 内容长度约 200-400 字
9. 逻辑连贯，段落之间有自然过渡

以下是用户已读的论文语料库，每篇论文的 ID 标注在方括号中：`;

    const userMessage = `语料库：\n${corpusText.slice(0, 6000)}\n\n用户的写作需求：${topic}`;

    const result = await chatCompletion(systemPrompt, userMessage, {
      temperature: 0.5,
      maxTokens: 2048,
    });

    return Response.json({ content: result });

  } catch (error) {
    console.error('Writing generate error:', error);
    return Response.json({ error: '生成失败，请重试' }, { status: 500 });
  }
}
